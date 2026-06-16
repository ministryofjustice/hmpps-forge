import {
  GovUKTextInput,
  GovUKButton,
  GovUKRadioInput,
  GovUKInsetText,
} from '@ministryofjustice/hmpps-forge/govuk-components'

import {
  journey,
  step,
  access,
  submit,
  redirect,
  validation,
  and,
  or,
  Answer,
  Data,
  Condition,
  Self,
  Transformer,
} from '../../src/authoring'
import { Effects } from './contractHelpers'

export const dependentWhenClearsAnswerJourney = journey({
  code: 'dw-clears',
  path: '/dw-clears',
  title: 'DependentWhen clears answer',
  onAccess: [access({ effects: [Effects.LoadAnswers('dw-clears')] })],
  steps: [
    step({
      path: '/contact',
      title: 'Contact',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'contactMethod',
          fieldset: { legend: { text: 'How should we contact you?' } },
          items: [
            { value: 'email', text: 'Email' },
            { value: 'phone', text: 'Phone' },
          ],
        }),
        GovUKTextInput({
          code: 'emailAddress',
          label: 'Email address',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('dw-clears')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const dependentWhenRetainsAnswerJourney = journey({
  code: 'dw-retains',
  path: '/dw-retains',
  title: 'DependentWhen retains answer',
  onAccess: [access({ effects: [Effects.LoadAnswers('dw-retains')] })],
  steps: [
    step({
      path: '/contact',
      title: 'Contact',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'contactMethod',
          fieldset: { legend: { text: 'How should we contact you?' } },
          items: [
            { value: 'email', text: 'Email' },
            { value: 'phone', text: 'Phone' },
          ],
        }),
        GovUKTextInput({
          code: 'emailAddress',
          label: 'Email address',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('dw-retains')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const dependentWhenSkipsValidationJourney = journey({
  code: 'dw-skip-valid',
  path: '/dw-skip-valid',
  title: 'DependentWhen skips validation',
  steps: [
    step({
      path: '/contact',
      title: 'Contact',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'contactMethod',
          fieldset: { legend: { text: 'How should we contact you?' } },
          items: [
            { value: 'email', text: 'Email' },
            { value: 'phone', text: 'Phone' },
          ],
        }),
        GovUKTextInput({
          code: 'emailAddress',
          label: 'Email address',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter an email address',
            }),
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const dependentWhenRunsValidationJourney = journey({
  code: 'dw-runs-valid',
  path: '/dw-runs-valid',
  title: 'DependentWhen runs validation when true',
  steps: [
    step({
      path: '/contact',
      title: 'Contact',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'contactMethod',
          fieldset: { legend: { text: 'How should we contact you?' } },
          items: [
            { value: 'email', text: 'Email' },
            { value: 'phone', text: 'Phone' },
          ],
        }),
        GovUKTextInput({
          code: 'emailAddress',
          label: 'Email address',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter an email address',
            }),
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const dependentWhenMutationTrailJourney = journey({
  code: 'dw-mutations',
  path: '/dw-mutations',
  title: 'DependentWhen mutation trail',
  onAccess: [access({ effects: [Effects.LoadAnswers('dw-mutations')] })],
  steps: [
    step({
      path: '/contact',
      title: 'Contact',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'contactMethod',
          fieldset: { legend: { text: 'How should we contact you?' } },
          items: [
            { value: 'email', text: 'Email' },
            { value: 'phone', text: 'Phone' },
          ],
        }),
        GovUKTextInput({
          code: 'emailAddress',
          label: 'Email address',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('dw-mutations')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const visibleWhenHidesBlockJourney = journey({
  code: 'vw-hides',
  path: '/vw-hides',
  title: 'VisibleWhen hides block',
  onAccess: [access({ effects: [Effects.LoadAnswers('vw-hides')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({ code: 'shown', label: 'Shown field' }),
        GovUKTextInput({ code: 'hidden', label: 'Hidden field', visibleWhen: false }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('vw-hides')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const visibleWhenDynamicJourney = journey({
  code: 'vw-dynamic',
  path: '/vw-dynamic',
  title: 'VisibleWhen dynamic',
  onAccess: [access({ effects: [Effects.LoadAnswers('vw-dynamic')] })],
  steps: [
    step({
      path: '/contact',
      title: 'Contact',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'contactMethod',
          fieldset: { legend: { text: 'Contact method' } },
          items: [
            { value: 'email', text: 'Email' },
            { value: 'phone', text: 'Phone' },
          ],
        }),
        GovUKTextInput({
          code: 'emailAddress',
          label: 'Email address',
          visibleWhen: Answer('contactMethod').match(Condition.Equals('email')),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('vw-dynamic')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const visibleWhenPreservesAnswerJourney = journey({
  code: 'vw-preserves',
  path: '/vw-preserves',
  title: 'VisibleWhen preserves answer',
  onAccess: [access({ effects: [Effects.LoadAnswers('vw-preserves')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'toggle',
          fieldset: { legend: { text: 'Show detail?' } },
          items: [
            { value: 'yes', text: 'Yes' },
            { value: 'no', text: 'No' },
          ],
        }),
        GovUKTextInput({
          code: 'detail',
          label: 'Detail',
          visibleWhen: Answer('toggle').match(Condition.Equals('yes')),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('vw-preserves')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const visibleWhenStillValidatesJourney = journey({
  code: 'vw-validates',
  path: '/vw-validates',
  title: 'VisibleWhen still validates',
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKTextInput({
          code: 'hiddenField',
          label: 'Hidden',
          visibleWhen: false,
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'This field is required',
            }),
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const combinedVisibleAndDependentJourney = journey({
  code: 'combined-vw-dw',
  path: '/combined-vw-dw',
  title: 'Combined visibleWhen and dependentWhen',
  onAccess: [access({ effects: [Effects.LoadAnswers('combined-vw-dw')] })],
  steps: [
    step({
      path: '/contact',
      title: 'Contact',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'contactMethod',
          fieldset: { legend: { text: 'How should we contact you?' } },
          items: [
            { value: 'email', text: 'Email' },
            { value: 'phone', text: 'Phone' },
          ],
        }),
        GovUKTextInput({
          code: 'emailAddress',
          label: 'Email address',
          visibleWhen: Answer('contactMethod').match(Condition.Equals('email')),
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter an email address',
            }),
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            effects: [Effects.SaveAnswers('combined-vw-dw')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const unreachableStepCleardownJourney = journey({
  code: 'cleardown',
  path: '/cleardown',
  title: 'Unreachable step cleardown',
  onAccess: [access({ effects: [Effects.LoadAnswers('cleardown')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'route',
          fieldset: { legend: { text: 'Which route?' } },
          items: [
            { value: 'detail', text: 'Detail' },
            { value: 'skip', text: 'Skip' },
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('cleardown')],
            next: [
              redirect({ when: Answer('route').match(Condition.Equals('detail')), goto: 'detail' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({
      path: '/detail',
      title: 'Detail',
      blocks: [GovUKTextInput({ code: 'detail', label: 'Detail' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('cleardown')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const conditionalEntryStepJourney = journey({
  code: 'cond-entry',
  path: '/cond-entry',
  title: 'Conditional entry step',
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

export const unreachableRedirectsToEntryJourney = journey({
  code: 'unreach-entry',
  path: '/unreach-entry',
  title: 'Unreachable redirects to entry',
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

export const dependentWhenOnlyPostJourney = journey({
  code: 'dw-post-only',
  path: '/dw-post-only',
  title: 'DependentWhen only on POST',
  onAccess: [access({ effects: [Effects.LoadAnswers('dw-post-only')] })],
  steps: [
    step({
      path: '/contact',
      title: 'Contact',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'contactMethod',
          fieldset: { legend: { text: 'Contact method' } },
          items: [
            { value: 'email', text: 'Email' },
            { value: 'phone', text: 'Phone' },
          ],
        }),
        GovUKTextInput({
          code: 'emailAddress',
          label: 'Email address',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('dw-post-only')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const visibleWhenNonFieldBlockJourney = journey({
  code: 'vw-nonfield',
  path: '/vw-nonfield',
  title: 'VisibleWhen on non-field block',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/info',
      title: 'Info',
      reachability: { entryWhen: true },
      blocks: [
        GovUKInsetText({
          text: 'Conditional message',
          visibleWhen: Data('showMessage').match(Condition.Equals(true)),
        }),
        GovUKTextInput({ code: 'name', label: 'Name' }),
        GovUKButton({ text: 'Continue' }),
      ],
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

export const postThenGetCycleJourney = journey({
  code: 'post-get-cycle',
  path: '/post-get-cycle',
  title: 'POST then GET cycle',
  onAccess: [access({ effects: [Effects.LoadAnswers('post-get-cycle')] })],
  steps: [
    step({
      path: '/contact',
      title: 'Contact',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'contactMethod',
          fieldset: { legend: { text: 'Contact method' } },
          items: [
            { value: 'email', text: 'Email' },
            { value: 'phone', text: 'Phone' },
          ],
        }),
        GovUKTextInput({
          code: 'emailAddress',
          label: 'Email address',
          visibleWhen: Answer('contactMethod').match(Condition.Equals('email')),
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('post-get-cycle')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const divergentVisibleAndDependentJourney = journey({
  code: 'divergent-vw-dw',
  path: '/divergent-vw-dw',
  title: 'Divergent visibleWhen and dependentWhen',
  onAccess: [access({ effects: [Effects.LoadAnswers('divergent-vw-dw')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'showField',
          fieldset: { legend: { text: 'Show field?' } },
          items: [
            { value: 'yes', text: 'Yes' },
            { value: 'no', text: 'No' },
          ],
        }),
        GovUKRadioInput({
          code: 'activateField',
          fieldset: { legend: { text: 'Activate field?' } },
          items: [
            { value: 'yes', text: 'Yes' },
            { value: 'no', text: 'No' },
          ],
        }),
        GovUKTextInput({
          code: 'conditionalField',
          label: 'Conditional',
          visibleWhen: Answer('showField').match(Condition.Equals('yes')),
          dependentWhen: Answer('activateField').match(Condition.Equals('yes')),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('divergent-vw-dw')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const multipleDependentWhenFieldsJourney = journey({
  code: 'multi-dw',
  path: '/multi-dw',
  title: 'Multiple dependentWhen fields',
  onAccess: [access({ effects: [Effects.LoadAnswers('multi-dw')] })],
  steps: [
    step({
      path: '/preferences',
      title: 'Preferences',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'contactMethod',
          fieldset: { legend: { text: 'Contact method' } },
          items: [
            { value: 'email', text: 'Email' },
            { value: 'phone', text: 'Phone' },
            { value: 'post', text: 'Post' },
          ],
        }),
        GovUKTextInput({
          code: 'emailAddress',
          label: 'Email',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
        }),
        GovUKTextInput({
          code: 'phoneNumber',
          label: 'Phone',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('phone')),
        }),
        GovUKTextInput({
          code: 'postalAddress',
          label: 'Address',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('post')),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('multi-dw')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const compoundDependentWhenJourney = journey({
  code: 'compound-dw',
  path: '/compound-dw',
  title: 'Compound dependentWhen predicate',
  onAccess: [access({ effects: [Effects.LoadAnswers('compound-dw')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'hasEmail',
          fieldset: { legend: { text: 'Has email?' } },
          items: [
            { value: 'yes', text: 'Yes' },
            { value: 'no', text: 'No' },
          ],
        }),
        GovUKRadioInput({
          code: 'wantsNotifications',
          fieldset: { legend: { text: 'Wants notifications?' } },
          items: [
            { value: 'yes', text: 'Yes' },
            { value: 'no', text: 'No' },
          ],
        }),
        GovUKTextInput({
          code: 'notificationEmail',
          label: 'Notification email',
          dependentWhen: and(
            Answer('hasEmail').match(Condition.Equals('yes')),
            Answer('wantsNotifications').match(Condition.Equals('yes')),
          ),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('compound-dw')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const orDependentWhenJourney = journey({
  code: 'or-dw',
  path: '/or-dw',
  title: 'Or dependentWhen predicate',
  onAccess: [access({ effects: [Effects.LoadAnswers('or-dw')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'role',
          fieldset: { legend: { text: 'Role' } },
          items: [
            { value: 'admin', text: 'Admin' },
            { value: 'manager', text: 'Manager' },
            { value: 'viewer', text: 'Viewer' },
          ],
        }),
        GovUKTextInput({
          code: 'accessCode',
          label: 'Access code',
          dependentWhen: or(
            Answer('role').match(Condition.Equals('admin')),
            Answer('role').match(Condition.Equals('manager')),
          ),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('or-dw')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const formatterThenDependentWhenJourney = journey({
  code: 'fmt-dw',
  path: '/fmt-dw',
  title: 'Formatter then dependentWhen',
  onAccess: [access({ effects: [Effects.LoadAnswers('fmt-dw')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'includeNotes',
          fieldset: { legend: { text: 'Include notes?' } },
          items: [
            { value: 'yes', text: 'Yes' },
            { value: 'no', text: 'No' },
          ],
        }),
        GovUKTextInput({
          code: 'notes',
          label: 'Notes',
          formatters: [Transformer.String.Trim()],
          dependentWhen: Answer('includeNotes').match(Condition.Equals('yes')),
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('fmt-dw')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const cleardownMutationTrailJourney = journey({
  code: 'cleardown-trail',
  path: '/cleardown-trail',
  title: 'Cleardown mutation trail',
  onAccess: [access({ effects: [Effects.LoadAnswers('cleardown-trail')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'route',
          fieldset: { legend: { text: 'Which route?' } },
          items: [
            { value: 'detail', text: 'Detail' },
            { value: 'skip', text: 'Skip' },
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('cleardown-trail')],
            next: [
              redirect({ when: Answer('route').match(Condition.Equals('detail')), goto: 'detail' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({
      path: '/detail',
      title: 'Detail',
      blocks: [GovUKTextInput({ code: 'detail', label: 'Detail' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('cleardown-trail')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const cleardownOnGetJourney = journey({
  code: 'cleardown-get',
  path: '/cleardown-get',
  title: 'Cleardown on GET',
  onAccess: [access({ effects: [Effects.LoadAnswers('cleardown-get')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'route',
          fieldset: { legend: { text: 'Which route?' } },
          items: [
            { value: 'detail', text: 'Detail' },
            { value: 'skip', text: 'Skip' },
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('cleardown-get')],
            next: [
              redirect({ when: Answer('route').match(Condition.Equals('detail')), goto: 'detail' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({
      path: '/detail',
      title: 'Detail',
      blocks: [GovUKTextInput({ code: 'detail', label: 'Detail' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('cleardown-get')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const iteratorCleardownJourney = journey({
  code: 'iter-cleardown',
  path: '/iter-cleardown',
  title: 'Iterator cleardown',
  onAccess: [access({ effects: [Effects.LoadAnswers('iter-cleardown')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'route',
          fieldset: { legend: { text: 'Which route?' } },
          items: [
            { value: 'members', text: 'Members' },
            { value: 'skip', text: 'Skip' },
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('iter-cleardown')],
            next: [
              redirect({ when: Answer('route').match(Condition.Equals('members')), goto: 'members' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({
      code: 'members',
      path: '/members',
      title: 'Members',
      cleardownFieldCodes: ['^memberName_\\d+$'],
      blocks: [GovUKTextInput({ code: 'memberName_0', label: 'Member 1 name' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('iter-cleardown')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})

export const conditionalEntryCleardownJourney = journey({
  code: 'cond-entry-clear',
  path: '/cond-entry-clear',
  title: 'Conditional entry cleardown',
  onAccess: [access({ effects: [Effects.LoadData(), Effects.LoadAnswers('cond-entry-clear')] })],
  steps: [
    step({
      path: '/main',
      title: 'Main',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Main step' })],
    }),
    step({
      path: '/bonus',
      title: 'Bonus',
      reachability: { entryWhen: Data('bonusEnabled').match(Condition.Equals(true)) },
      blocks: [GovUKTextInput({ code: 'bonusDetail', label: 'Bonus detail' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('cond-entry-clear')],
            next: [redirect({ goto: 'bonus-done' })],
          },
        }),
      ],
    }),
    step({
      code: 'bonus-done',
      path: '/bonus-done',
      title: 'Bonus Done',
      blocks: [GovUKInsetText({ text: 'Bonus complete' })],
    }),
  ],
})

export const parameterizedCleardownJourney = journey({
  code: 'param-cleardown',
  path: '/param-cleardown/:id',
  title: 'Parameterized Cleardown',
  onAccess: [access({ effects: [Effects.LoadAnswers('param-cleardown')] })],
  steps: [
    step({
      path: '/choose',
      title: 'Choose',
      reachability: { entryWhen: true },
      blocks: [
        GovUKRadioInput({
          code: 'route',
          fieldset: { legend: { text: 'Which route?' } },
          items: [
            { value: 'detail', text: 'Detail' },
            { value: 'skip', text: 'Skip' },
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('param-cleardown')],
            next: [
              redirect({ when: Answer('route').match(Condition.Equals('detail')), goto: 'detail' }),
              redirect({ goto: 'done' }),
            ],
          },
        }),
      ],
    }),
    step({
      path: '/detail',
      title: 'Detail',
      blocks: [GovUKTextInput({ code: 'detail', label: 'Detail' }), GovUKButton({ text: 'Continue' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [Effects.SaveAnswers('param-cleardown')],
            next: [redirect({ goto: 'done' })],
          },
        }),
      ],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
  ],
})
