import {
  GovUKTextInput,
  GovUKButton,
  GovUKRadioInput,
  GovUKInsetText,
  govukComponents,
} from '@ministryofjustice/hmpps-forge/govuk-components'

import {
  journey,
  step,
  access,
  submit,
  redirect,
  throwError,
  validation,
  tieBreaker,
  defineEffectFunctions,
  type EffectFunctionExpr,
  Answer,
  Data,
  Post,
  Format,
  Self,
  Condition,
} from '../../src/authoring'
import { ForgeTestHarness } from '../../src/testing'
import { Effects, effectImplementations } from './contractHelpers'

interface NavigationEffectShape {
  SetHeader: (name: string, value: string) => EffectFunctionExpr
}

const { effects: NavigationEffects, implementations: navigationEffectImplementations } =
  defineEffectFunctions<NavigationEffectShape>({
    SetHeader: () => (context, name: string, value: string) => {
      context.setResponseHeader(name, value)
    },
  })

export function createNavigationClient(journeyDef: ReturnType<typeof journey>) {
  return new ForgeTestHarness()
    .registerGlobalComponents(govukComponents)
    .registerPackage({
      journey: journeyDef,
      functions: { ...effectImplementations, ...navigationEffectImplementations },
    })
    .createClient()
}

export const basicRedirectJourney = journey({
  code: 'basic-redirect',
  path: '/basic-redirect',
  title: 'Basic Redirect',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const validationBranchJourney = journey({
  code: 'val-branch',
  path: '/val-branch',
  title: 'Validation Branch',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'name',
          label: 'Name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            next: [redirect({ goto: 'success' })],
          },
          onInvalid: {
            next: [redirect({ goto: 'error' })],
          },
        }),
      ],
    }),
    step({ code: 'success', path: '/success', title: 'Success', blocks: [] }),
    step({ code: 'error', path: '/error', title: 'Error', blocks: [] }),
  ],
})

export const onAlwaysHaltsJourney = journey({
  code: 'always-halts',
  path: '/always-halts',
  title: 'Always Halts',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'name',
          label: 'Name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onAlways: {
            next: [redirect({ when: Data('skipValidation').match(Condition.Equals(true)), goto: 'exit' })],
          },
          onValid: {
            next: [redirect({ goto: 'next' })],
          },
        }),
      ],
    }),
    step({ code: 'exit', path: '/exit', title: 'Exit', blocks: [] }),
    step({ code: 'next', path: '/next', title: 'Next', blocks: [] }),
  ],
})

export const conditionalCascadeJourney = journey({
  code: 'cascade',
  path: '/cascade',
  title: 'Cascade',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'choice',
          fieldset: { legend: { text: 'Choose' } },
          items: [
            { value: 'a', text: 'Option A' },
            { value: 'b', text: 'Option B' },
            { value: 'c', text: 'Option C' },
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            next: [
              redirect({ when: Answer('choice').match(Condition.Equals('a')), goto: 'path-a' }),
              redirect({ when: Answer('choice').match(Condition.Equals('b')), goto: 'path-b' }),
              redirect({ goto: 'default' }),
            ],
          },
        }),
      ],
    }),
    step({ code: 'path-a', path: '/path-a', title: 'Path A', blocks: [] }),
    step({ code: 'path-b', path: '/path-b', title: 'Path B', blocks: [] }),
    step({ code: 'default', path: '/default', title: 'Default', blocks: [] }),
  ],
})

export const throwErrorCascadeJourney = journey({
  code: 'throw-error',
  path: '/throw-error',
  title: 'Throw Error',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'confirm',
          fieldset: { legend: { text: 'Confirm?' } },
          items: [
            { value: 'yes', text: 'Yes' },
            { value: 'no', text: 'No' },
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            next: [
              throwError({
                when: Answer('confirm').not.match(Condition.Equals('yes')),
                status: 400,
                message: 'Must confirm before continuing',
              }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const dynamicGotoJourney = journey({
  code: 'dynamic-goto',
  path: '/dynamic-goto',
  title: 'Dynamic Goto',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            next: [redirect({ goto: Data('destination') })],
          },
        }),
      ],
    }),
    step({ code: 'step-a', path: '/step-a', title: 'Step A', blocks: [] }),
    step({ code: 'step-b', path: '/step-b', title: 'Step B', blocks: [] }),
  ],
})

export const unreachableStepJourney = journey({
  code: 'unreachable',
  path: '/unreachable',
  title: 'Unreachable',
  steps: [
    step({
      path: '/step-one',
      title: 'Step One',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'name',
          label: 'Name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            next: [redirect({ goto: 'step-two' })],
          },
        }),
      ],
    }),
    step({
      code: 'step-two',
      path: '/step-two',
      title: 'Step Two',
      blocks: [GovUKInsetText({ text: 'Done' })],
    }),
  ],
})

export const accessRedirectJourney = journey({
  code: 'access-redirect',
  path: '/access-redirect',
  title: 'Access Redirect',
  onAccess: [
    access({
      effects: [Effects.LoadData()],
      next: [redirect({ when: Data('blocked').match(Condition.Equals(true)), goto: 'denied' })],
    }),
  ],
  steps: [
    step({
      path: '/protected',
      title: 'Protected',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'secret', label: 'Secret' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'denied', path: '/denied', title: 'Denied', blocks: [] }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const accessErrorJourney = journey({
  code: 'access-error',
  path: '/access-error',
  title: 'Access Error',
  onAccess: [
    access({
      effects: [Effects.LoadData()],
      next: [
        throwError({
          when: Data('notFound').match(Condition.Equals(true)),
          status: 404,
          message: 'Resource not found',
        }),
      ],
    }),
  ],
  steps: [
    step({
      path: '/resource',
      title: 'Resource',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Resource content' })],
    }),
  ],
})

export const multiSubmitHooksJourney = journey({
  code: 'multi-hooks',
  path: '/multi-hooks',
  title: 'Multi Hooks',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({ code: 'query', label: 'Search' }),
        GovUKButton({ text: 'Search' }),
        GovUKButton({ text: 'Reset' }),
      ],
      onSubmission: [
        submit({
          when: Post('action').match(Condition.Equals('search')),
          validate: false,
          onAlways: { next: [redirect({ goto: 'results' })] },
        }),
        submit({
          when: Post('action').match(Condition.Equals('reset')),
          validate: false,
          onAlways: { next: [redirect({ goto: 'cleared' })] },
        }),
      ],
    }),
    step({ code: 'results', path: '/results', title: 'Results', blocks: [] }),
    step({ code: 'cleared', path: '/cleared', title: 'Cleared', blocks: [] }),
  ],
})

export const onValidEffectsJourney = journey({
  code: 'valid-effects',
  path: '/valid-effects',
  title: 'Valid Effects',
  onAccess: [access({ effects: [Effects.LoadAnswers('valid-effects')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'name',
          label: 'Name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            effects: [Effects.SaveAnswers('valid-effects')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const dynamicErrorMessageJourney = journey({
  code: 'dynamic-error-msg',
  path: '/dynamic-error-msg',
  title: 'Dynamic Error Message',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            next: [
              throwError({
                when: Data('errorDetail').match(Condition.IsRequired()),
                status: 500,
                message: Format('Save failed: %1', Data('errorDetail')),
              }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const conditionalEntryJourney = journey({
  code: 'cond-entry',
  path: '/cond-entry',
  title: 'Conditional Entry',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/standard',
      title: 'Standard',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Standard flow' })],
    }),
    step({
      path: '/premium',
      title: 'Premium',
      reachability: { entryWhen: Data('isPremium').match(Condition.Equals(true)) },
      blocks: [GovUKInsetText({ text: 'Premium flow' })],
    }),
  ],
})

export const resumeJourney = journey({
  code: 'resume',
  path: '/resume',
  title: 'Resume',
  reachability: { resumeWhen: true },
  onAccess: [access({ effects: [Effects.LoadAnswers('resume')] })],
  steps: [
    step({
      path: '/step-one',
      title: 'Step One',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'firstName',
          label: 'First name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            effects: [Effects.SaveAnswers('resume')],
            next: [redirect({ goto: 'step-two' })],
          },
        }),
      ],
    }),
    step({
      path: '/step-two',
      title: 'Step Two',
      blocks: [
        GovUKTextInput({
          code: 'lastName',
          label: 'Last name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            effects: [Effects.SaveAnswers('resume')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const unreachableFrontierJourney = journey({
  code: 'frontier',
  path: '/frontier',
  title: 'Frontier',
  reachability: { unreachableRedirect: 'frontier' },
  onAccess: [access({ effects: [Effects.LoadAnswers('frontier')] })],
  steps: [
    step({
      path: '/step-one',
      title: 'Step One',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'firstName',
          label: 'First name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: { next: [redirect({ goto: 'step-two' })] },
        }),
      ],
    }),
    step({
      path: '/step-two',
      title: 'Step Two',
      blocks: [
        GovUKTextInput({
          code: 'lastName',
          label: 'Last name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: { next: [redirect({ goto: 'step-three' })] },
        }),
      ],
    }),
    step({
      path: '/step-three',
      title: 'Step Three',
      blocks: [GovUKInsetText({ text: 'Final' })],
    }),
  ],
})

export const queryStringRedirectJourney = journey({
  code: 'query-redirect',
  path: '/query-redirect',
  title: 'Query Redirect',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'review?from=form#summary' })] },
        }),
      ],
    }),
    step({ code: 'review', path: '/review', title: 'Review', blocks: [] }),
  ],
})

export const paramRedirectJourney = journey({
  code: 'param-redirect',
  path: '/param-redirect/:id',
  title: 'Param Redirect',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const guardsJourney = journey({
  code: 'guards',
  path: '/guards',
  title: 'Guards',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          guards: Data('sessionValid').match(Condition.Equals(true)),
          validate: false,
          onAlways: { next: [redirect({ goto: 'done' })] },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const tieBreakerJourney = journey({
  code: 'tie-breaker',
  path: '/tie-breaker',
  title: 'Tie Breaker',
  steps: [
    step({
      path: '/low-priority',
      title: 'Low Priority',
      reachability: {
        entryWhen: true,
        tieBreakers: [tieBreaker({ priority: 10 })],
      },
      blocks: [GovUKInsetText({ text: 'Low priority' })],
    }),
    step({
      path: '/high-priority',
      title: 'High Priority',
      reachability: {
        entryWhen: true,
        tieBreakers: [tieBreaker({ priority: 100 })],
      },
      blocks: [GovUKInsetText({ text: 'High priority' })],
    }),
  ],
})

export const unreachableRedirectToEntryJourney = journey({
  code: 'unreach-entry',
  path: '/unreach-entry',
  title: 'Unreachable Entry',
  steps: [
    step({
      path: '/preamble',
      title: 'Preamble',
      blocks: [GovUKInsetText({ text: 'Preamble' })],
    }),
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'name',
          label: 'Name',
          validWhen: [validation({ condition: Self().match(Condition.IsRequired()), message: 'Required' })],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: { next: [redirect({ goto: 'preamble' })] },
        }),
      ],
    }),
  ],
})

export const headerSurvivesRedirectJourney = journey({
  code: 'header-redirect',
  path: '/header-redirect',
  title: 'Header Redirect',
  onAccess: [
    access({
      effects: [Effects.LoadData(), NavigationEffects.SetHeader('X-Custom-Nav', 'from-access')],
      next: [redirect({ when: Data('shouldRedirect').match(Condition.Equals(true)), goto: 'target' })],
    }),
  ],
  steps: [
    step({
      path: '/start',
      title: 'Start',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Start' })],
    }),
    step({ code: 'target', path: '/target', title: 'Target', blocks: [] }),
  ],
})

export const dynamicGotoFallbackJourney = journey({
  code: 'dynamic-fallback',
  path: '/dynamic-fallback',
  title: 'Dynamic Fallback',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKTextInput({ code: 'name', label: 'Name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            next: [redirect({ goto: Data('destination') }), redirect({ goto: 'fallback' })],
          },
        }),
      ],
    }),
    step({ code: 'step-a', path: '/step-a', title: 'Step A', blocks: [] }),
    step({ code: 'fallback', path: '/fallback', title: 'Fallback', blocks: [] }),
  ],
})
