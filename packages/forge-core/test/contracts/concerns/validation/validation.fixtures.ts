import {
  access,
  condition,
  generator,
  journey,
  redirect,
  step,
  submit,
  transformer,
  validation,
  Condition,
  Data,
  Format,
  Iterator,
  Loop,
  Self,
  type ResolvableValue,
} from '../../../../src/authoring'
import { CollectionBlock } from '../../../../src/components'
import { Effects } from '../../contractHelpers'
import { TextField } from '../../testComponents'

// Narrative journeys that don't fit the payload-in-placement shape of
// stepScaffold: they need extra steps, journey-level reachability
// config, or submission hooks beyond the standard validate-and-redirect.

export const reachabilityDisabledValidationJourney = journey({
  code: 'reach-disabled-validation',
  path: '/reach-disabled-validation',
  title: 'Reachability Disabled Validation',
  reachability: { disableReachabilityChecks: true },
  onAccess: [access({ effects: [Effects.LoadAnswers('reach-disabled-validation')] })],
  steps: [
    step({
      path: '/start',
      title: 'Start',
      blocks: [TextField({ code: 'name' })],
    }),
    step({
      path: '/date',
      title: 'Date',
      blocks: [
        TextField({
          code: 'targetDate',
          validWhen: [
            validation({
              condition: Self().match(Condition.Date.IsToday()),
              message: 'Date must be today',
            }),
          ],
        }),
      ],
    }),
  ],
})

export const validateFalseJourney = journey({
  code: 'no-validate',
  path: '/no-validate',
  title: 'Validate false',
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'fullName',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your full name',
            }),
          ],
        }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('no-validate')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({
      code: 'done',
      path: '/done',
      title: 'Done',
      blocks: [],
    }),
  ],
})

/**
 * The canonical a -> b -> c chain, with the rule extras under test spread
 * onto step b's field rule. The validities round that feeds reachability
 * runs with the default group only and skips submissionOnly rules, so a
 * failure confined to those rules must not gate navigation to c.
 */
function ruleFilterChainJourney(code: string, ruleExtras: { submissionOnly?: boolean; groups?: string[] }) {
  return journey({
    code,
    path: `/${code}`,
    title: code,
    onAccess: [access({ effects: [Effects.LoadAnswers(code)] })],
    steps: [
      step({
        code: 'a',
        path: '/a',
        title: 'A',
        reachability: { entryWhen: true },
        blocks: [
          TextField({
            code: 'fieldA',
            validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
          }),
        ],
        onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'b' })] } })],
      }),
      step({
        code: 'b',
        path: '/b',
        title: 'B',
        blocks: [
          TextField({
            code: 'fieldB',
            validWhen: [
              validation({
                condition: Self().match(Condition.Equals('valid-b')),
                message: 'Must be valid-b',
                ...ruleExtras,
              }),
            ],
          }),
        ],
        onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'c' })] } })],
      }),
      step({ code: 'c', path: '/c', title: 'C', blocks: [TextField({ code: 'fieldC' })] }),
    ],
  })
}

export const submissionOnlyChainJourney = ruleFilterChainJourney('sub-only-chain', { submissionOnly: true })

export const nonDefaultGroupChainJourney = ruleFilterChainJourney('grouped-chain', { groups: ['special'] })

/**
 * The same a -> b -> c chain, but step b's only rules live inside an
 * iterator template. Fields inside iterator templates are excluded from
 * the eager validities round that feeds reachability, so per-item
 * failures must not gate navigation to c even though the same rules
 * fail a direct submission of b.
 */
export const iteratorOnlyChainJourney = journey({
  code: 'iterator-only-chain',
  path: '/iterator-only-chain',
  title: 'Iterator only chain',
  onAccess: [access({ effects: [Effects.LoadAnswers('iterator-only-chain'), Effects.LoadData()] })],
  steps: [
    step({
      code: 'a',
      path: '/a',
      title: 'A',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'fieldA',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
      ],
      onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'b' })] } })],
    }),
    step({
      code: 'b',
      path: '/b',
      title: 'B',
      blocks: [
        CollectionBlock({
          collection: Data('members').each(
            Iterator.Map([
              TextField({
                code: Format('memberName_%1', Loop.Index0()),
                validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Enter a name' })],
              }),
            ]),
          ),
        }),
      ],
      onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'c' })] } })],
    }),
    step({ code: 'c', path: '/c', title: 'C', blocks: [TextField({ code: 'fieldC' })] }),
  ],
})

const ExplodingCondition = condition('Validation.Explodes', {
  factory: () => () => {
    throw new Error('condition blew up')
  },
})

export const throwingConditionJourney = journey({
  code: 'throwing-rule',
  path: '/throwing-rule',
  title: 'Throwing rule',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        TextField({
          code: 'name',
          validWhen: [validation({ condition: Self().match(ExplodingCondition()), message: 'Never shown' })],
        }),
      ],
      onSubmission: [submit({ validate: true, onValid: { next: [redirect({ goto: 'done' })] } })],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

// Regression coverage for generated-code argument scoping: a function call
// with arguments as the subject of another function call used to compile both
// argument consts to one name, and the inner declaration shadowed the outer
// before it ran ("Cannot access 'functionArgument1' before initialization").
export const FixedText = generator('ScopingFixed', {
  factory: () => (text: ResolvableValue) => text,
})
export const MutateState = generator('ScopingMutateState', {
  factory: () => (state: ResolvableValue) => {
    if (typeof state === 'object' && state !== null) {
      Reflect.set(state, 'value', 'after')
    }

    return 'mutated'
  },
})
export const IdentityValue = generator('ScopingIdentity', {
  factory: () => (value: ResolvableValue) => value,
})
export const ArgumentsInOrder = generator('ScopingArgumentsInOrder', {
  factory: () => (first: ResolvableValue, second: ResolvableValue, state: ResolvableValue) => {
    const observedValues =
      typeof state === 'object' && state !== null ? Reflect.get(state, 'observedValues') : undefined

    if (Array.isArray(observedValues)) {
      observedValues.push(second)
    }

    return first === 'mutated'
  },
})
export const EqualsValue = condition('ScopingEquals', {
  factory: () => (value: ResolvableValue, expected: ResolvableValue) => value === expected,
})
export const LengthBetween = condition('ScopingLengthBetween', {
  factory: () => (value: ResolvableValue, lower: number, upper: number) =>
    String(value).length >= lower && String(value).length <= upper,
})
export const AppendSuffix = transformer('ScopingAppendSuffix', {
  factory: () => (value: ResolvableValue, suffix: string) => `${value}${suffix}`,
})
