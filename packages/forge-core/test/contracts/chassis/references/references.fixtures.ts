import {
  access,
  journey,
  redirect,
  step,
  submit,
  Answer,
  Condition,
  Data,
  Format,
  Item,
  Iterator,
  Params,
  Query,
  Request,
  Self,
  Session,
} from '../../../../src/authoring'
import { ContractEffects, Effects } from '../../contractHelpers'
import { StaticText, TextField } from '../../testComponents'

/**
 * Copies a resolved reference into context data so the runner's `data` verdict
 * can observe it. Rows whose observed values are all undefined also assert the
 * `captureRan` sentinel, so absence never passes vacuously.
 */
export const CaptureValue = ContractEffects.register('CaptureValue', {
  factory: () => (context, key: string, value: unknown) => {
    context.setData(key, value)
  },
})

export const dataAndParamsJourney = journey({
  code: 'ref-sources',
  path: '/ref-sources/:caseId',
  title: 'Reference sources',
  onAccess: [
    access({
      effects: [
        Effects.LoadData(),
        CaptureValue('captureRan', 'yes'),
        CaptureValue('capturedFlavour', Data('flavour')),
        CaptureValue('capturedMissingData', Data('missingKey')),
        CaptureValue('capturedNestedMissing', Data('missingParent.child')),
        CaptureValue('capturedTheme', Data('profile.theme')),
        CaptureValue('capturedThemeByPath', Data('profile').path('theme')),
        CaptureValue('capturedCaseId', Params('caseId')),
        CaptureValue('capturedMissingParam', Params('missing')),
      ],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: 'Content' })],
    }),
  ],
})

// Deliberately no LoadData effect: the contract under test is that Session()
// reads the request session directly, while Data() sees only what effects
// have loaded into the context data store.
export const rawSessionJourney = journey({
  code: 'ref-session',
  path: '/ref-session',
  title: 'Raw session references',
  onAccess: [
    access({
      effects: [
        CaptureValue('captureRan', 'yes'),
        CaptureValue('capturedSessionFlag', Session('data.flag')),
        CaptureValue('capturedDataFlag', Data('flag')),
      ],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: 'Content' })],
    }),
  ],
})

// Answer() is rejected inside access hooks at compilation, so stored-answer
// reads outside submit hooks are observed through resolved block properties
// instead of a CaptureValue access effect.
export const storedAnswerJourney = journey({
  code: 'ref-stored',
  path: '/ref-stored',
  title: 'Stored answer reads',
  onAccess: [access({ effects: [Effects.LoadAnswers('ref-stored')] })],
  steps: [
    step({
      path: '/display',
      title: 'Display',
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: Answer('name') })],
    }),
  ],
})

export const crossStepAnswerJourney = journey({
  code: 'ref-cross-step',
  path: '/ref-cross-step',
  title: 'Cross-step answer reads',
  onAccess: [access({ effects: [Effects.LoadAnswers('ref-cross-step')] })],
  steps: [
    step({
      code: 'first',
      path: '/first',
      title: 'First',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'name' })],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            effects: [Effects.SaveAnswers('ref-cross-step')],
            next: [redirect({ goto: 'second' })],
          },
        }),
      ],
    }),
    step({
      code: 'second',
      path: '/second',
      title: 'Second',
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: Answer('name') })],
    }),
  ],
})

export const answerReachabilityJourney = journey({
  code: 'ref-reach',
  path: '/ref-reach',
  title: 'Answer-gated reachability',
  onAccess: [access({ effects: [Effects.LoadAnswers('ref-reach')] })],
  steps: [
    step({ code: 'start', path: '/start', title: 'Start', reachability: { entryWhen: true }, blocks: [] }),
    step({
      code: 'gated',
      path: '/gated',
      title: 'Gated',
      reachability: { entryWhen: Answer('visited').match(Condition.Equals('yes')) },
      blocks: [StaticText({ text: 'Gated' })],
    }),
  ],
})

export const selfOutsideValidationJourney = journey({
  code: 'ref-self-visible',
  path: '/ref-self-visible',
  title: 'Self outside validation',
  onAccess: [access({ effects: [Effects.LoadAnswers('ref-self-visible')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'secret', visibleWhen: Self().match(Condition.Equals('show')) })],
    }),
  ],
})

export const foundItemJourney = journey({
  code: 'ref-found',
  path: '/ref-found',
  title: 'Base references into found items',
  onAccess: [
    access({
      effects: [
        Effects.LoadData(),
        CaptureValue('captureRan', 'yes'),
        CaptureValue(
          'foundName',
          Data('people')
            .each(Iterator.Find(Item().path('id').match(Condition.Equals(2))))
            .path('name'),
        ),
        CaptureValue(
          'missingName',
          Data('people')
            .each(Iterator.Find(Item().path('id').match(Condition.Equals(99))))
            .path('name'),
        ),
      ],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: 'Content' })],
    }),
  ],
})

// The '@key' segment resolves undefined for array inputs, and Format
// substitutes an empty string for absent replacements, so ':a' proves the
// key was undefined while the value still resolved.
export const arrayKeyJourney = journey({
  code: 'ref-array-key',
  path: '/ref-array-key',
  title: 'Loop item keys on array inputs',
  onAccess: [
    access({
      effects: [
        Effects.LoadData(),
        CaptureValue('arrayKeys', Data('letters').each(Iterator.Map(Format('%1:%2', Item().key(), Item().value())))),
      ],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: 'Content' })],
    }),
  ],
})

export const requestMetadataJourney = journey({
  code: 'ref-request',
  path: '/ref-request',
  title: 'Request metadata references',
  onAccess: [
    access({
      effects: [
        CaptureValue('capturedUrl', Request.Url()),
        CaptureValue('capturedPath', Request.Path()),
        CaptureValue('capturedMethod', Request.Method()),
        CaptureValue('capturedHeader', Request.Headers('x-client')),
        CaptureValue('capturedCookie', Request.Cookies('theme')),
        CaptureValue('capturedMissingCookie', Request.Cookies('absent')),
        CaptureValue('capturedStateName', Request.State('user.name')),
        CaptureValue('capturedTab', Query('tab')),
        CaptureValue('capturedMissingQuery', Query('absent')),
      ],
    }),
  ],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: 'Content' })],
    }),
  ],
})
