import { submit, validation, Answer, Condition, Data, Post, Self } from '../../../../src/authoring'
import type { JourneyContractCase, StepContractCase } from '../../contractRunner'
import { CheckboxField, TextField } from '../../testComponents'
import {
  CaptureValue,
  answerReachabilityJourney,
  arrayKeyJourney,
  dataAndParamsJourney,
  foundItemJourney,
  rawSessionJourney,
} from './references.fixtures'

const nameField = TextField({ code: 'name' })
const dynamicCodeField = TextField({ code: Data('fieldSelector') })

export const journeyCases: JourneyContractCase[] = [
  {
    description: 'context data and route parameter sources',
    journey: dataAndParamsJourney,
    tests: [
      {
        name: 'should resolve Data() from the context data store when the key is set',
        path: '/ref-sources/abc/form',
        session: { data: { flavour: 'plain' } },
        data: { capturedFlavour: 'plain' },
      },
      {
        name: 'should resolve Data() to undefined when the key or a parent segment is absent',
        path: '/ref-sources/abc/form',
        data: { captureRan: 'yes', capturedMissingData: undefined, capturedNestedMissing: undefined },
      },
      {
        name: 'should navigate nested data values through dotted keys and .path() chaining',
        path: '/ref-sources/abc/form',
        session: { data: { profile: { theme: 'dark' } } },
        data: { capturedTheme: 'dark', capturedThemeByPath: 'dark' },
      },
      {
        name: 'should resolve Params() to the matched route parameter value',
        path: '/ref-sources/case-42/form',
        data: { capturedCaseId: 'case-42' },
      },
      {
        name: 'should resolve Params() to undefined when the route declares no such parameter',
        path: '/ref-sources/abc/form',
        data: { captureRan: 'yes', capturedMissingParam: undefined },
      },
    ],
  },
  {
    description: 'raw session source',
    journey: rawSessionJourney,
    tests: [
      {
        name: 'should resolve Session() from the raw request session rather than the context data store',
        path: '/ref-session/form',
        session: { data: { flag: 'raw-value' } },
        data: { capturedSessionFlag: 'raw-value', capturedDataFlag: undefined },
      },
      {
        name: 'should resolve Session() to undefined when the session holds no value at the path',
        path: '/ref-session/form',
        session: {},
        data: { captureRan: 'yes', capturedSessionFlag: undefined },
      },
    ],
  },
  {
    description: 'answer-gated reachability',
    journey: answerReachabilityJourney,
    tests: [
      {
        name: 'should resolve Answer() in a reachability condition to a stored answer',
        path: '/ref-reach/gated',
        session: { answers: { 'ref-reach': { visited: 'yes' } } },
        rendered: true,
      },
      {
        name: 'should redirect to the entry step when the answer gating reachability is absent',
        path: '/ref-reach/gated',
        session: {},
        redirectTo: '/ref-reach/start',
      },
    ],
  },
  {
    description: 'base references into Find results',
    journey: foundItemJourney,
    tests: [
      {
        name: 'should navigate into the found item with .path() chained after Iterator.Find',
        path: '/ref-found/form',
        session: {
          data: {
            people: [
              { id: 1, name: 'Ada' },
              { id: 2, name: 'Grace' },
            ],
          },
        },
        data: { foundName: 'Grace' },
      },
      {
        name: 'should resolve .path() after Iterator.Find to undefined when no item matches',
        path: '/ref-found/form',
        session: { data: { people: [{ id: 1, name: 'Ada' }] } },
        data: { captureRan: 'yes', missingName: undefined },
      },
    ],
  },
  {
    description: 'loop item keys on array inputs',
    journey: arrayKeyJourney,
    tests: [
      {
        name: 'should resolve Item().key() to undefined when the iterated input is an array',
        path: '/ref-array-key/form',
        session: { data: { letters: ['a', 'b'] } },
        data: { arrayKeys: [':a', ':b'] },
      },
    ],
  },
]

export const stepCases: StepContractCase[] = [
  {
    description: 'answer and post-body reads in submit hooks',
    step: {
      blocks: [nameField, CheckboxField({ code: 'colors' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [
              CaptureValue('captureRan', 'yes'),
              CaptureValue('answerName', Answer('name')),
              CaptureValue('answerByField', Answer(nameField)),
              CaptureValue('answerMissing', Answer('unanswered')),
              CaptureValue('answerColors', Answer('colors')),
              CaptureValue('postColors', Post('colors')),
              CaptureValue('postMissing', Post('absent')),
              CaptureValue('answerNested', Answer('user.address.postcode')),
              CaptureValue('answerDynamic', Answer(Data('fieldSelector'))),
              CaptureValue('answerByDynamicField', Answer(dynamicCodeField)),
            ],
          },
        }),
      ],
    },
    tests: [
      {
        name: 'should resolve Answer() in a submit hook to the just-posted parsed answer',
        post: { name: 'Jo' },
        data: { answerName: 'Jo' },
      },
      {
        name: 'should resolve Answer() through the field code when given a field definition',
        post: { name: 'Jo' },
        data: { answerByField: 'Jo' },
      },
      {
        name: 'should resolve Answer() to undefined when no answer exists for the code',
        post: {},
        data: { captureRan: 'yes', answerMissing: undefined },
      },
      {
        name: 'should read the raw submitted value through Post() and the normalized answer through Answer()',
        post: { colors: 'red' },
        data: { postColors: 'red', answerColors: ['red'] },
      },
      {
        name: 'should resolve Post() to undefined when the body has no such key',
        post: { name: 'x' },
        data: { captureRan: 'yes', postMissing: undefined },
      },
      {
        name: 'should treat a dotted Answer() key as a field code plus a path into the stored value',
        post: {},
        session: { answers: { user: { address: { postcode: 'AB1 2CD' } } } },
        data: { answerNested: 'AB1 2CD' },
      },
      {
        name: 'should resolve a dynamic field code expression before reading the answer',
        post: {},
        session: { answers: { chosen: 'stored-value' }, data: { fieldSelector: 'chosen' } },
        data: { answerDynamic: 'stored-value' },
      },
      {
        name: 'should resolve Answer() through a field definition whose code is a dynamic expression',
        post: {},
        session: { answers: { chosen: 'stored-value' }, data: { fieldSelector: 'chosen' } },
        data: { answerByDynamicField: 'stored-value' },
      },
    ],
  },
  {
    description: 'Self() resolution in field validation',
    step: {
      blocks: [
        TextField({
          code: 'first',
          validWhen: [validation({ condition: Self().match(Condition.Equals('yes')), message: 'First must be yes' })],
        }),
        TextField({
          code: 'second',
          validWhen: [validation({ condition: Self().match(Condition.Equals('yes')), message: 'Second must be yes' })],
        }),
      ],
    },
    tests: [
      {
        name: 'should resolve Self() to the submitted value of the field declaring the rule',
        post: { first: 'yes', second: 'yes' },
        valid: true,
      },
      {
        name: 'should resolve Self() per declaring field when several fields carry the same rule shape',
        post: { first: 'yes', second: 'no' },
        errors: { first: [], second: ['Second must be yes'] },
      },
    ],
  },
  {
    description: 'Post() resolution in field validation',
    step: {
      blocks: [
        TextField({
          code: 'name',
          validWhen: [
            validation({ condition: Post('gate').match(Condition.Equals('open')), message: 'The gate must be open' }),
          ],
        }),
      ],
    },
    tests: [
      {
        name: 'should resolve Post() in a validation rule to the raw submitted value',
        post: { name: 'Jo', gate: 'open' },
        valid: true,
      },
      {
        name: 'should resolve Post() in a validation rule to undefined when the body has no such key',
        post: { name: 'Jo' },
        errors: { name: ['The gate must be open'] },
      },
    ],
  },
]
