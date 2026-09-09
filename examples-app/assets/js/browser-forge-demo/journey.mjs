import {
  Answer,
  Condition,
  Self,
  access,
  createForgePackage,
  journey,
  redirect,
  step,
  submit,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKButton,
  GovUKHeading,
  GovUKRadioInput,
  GovUKTextInput,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { ClearDraft, LoadDraft, SaveDraft } from './effects.mjs'

export const browserDemoJourney = journey({
  code: 'browser-demo',
  title: 'Browser Forge demo',
  path: '/browser-demo',
  view: { locals: { browserDemoSection: 'basic' } },
  onAccess: [access({ effects: [LoadDraft('intro')] })],
  steps: [
    step({
      code: 'your-name',
      path: '/your-name',
      title: 'What is your name?',
      reachability: { entryWhen: true },
      blocks: [
        GovUKHeading({ text: 'What is your name?' }),
        GovUKTextInput({
          code: 'fullName',
          label: 'Full name',
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your full name',
            }),
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            effects: [SaveDraft('intro')],
            next: [redirect({ goto: 'contact' })],
          },
        }),
      ],
    }),
    step({
      code: 'contact',
      path: '/contact',
      title: 'How should we contact you?',
      blocks: [
        GovUKRadioInput({
          code: 'contactMethod',
          fieldset: {
            legend: {
              text: 'How should we contact you?',
              classes: GovUKUtilityClasses.Fieldset.LargeLabel,
              isPageHeading: true,
            },
          },
          items: [
            { value: 'email', text: 'Email' },
            { value: 'phone', text: 'Phone' },
          ],
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Select how we should contact you',
            }),
          ],
        }),
        GovUKTextInput({
          code: 'emailAddress',
          label: 'Email address',
          dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
          validWhen: [
            validation({
              condition: Self().match(Condition.IsRequired()),
              message: 'Enter your email address',
            }),
          ],
        }),
        GovUKButton({ text: 'Continue' }),
      ],
      onSubmission: [
        submit({
          validate: true,
          onValid: {
            effects: [SaveDraft('intro')],
            next: [redirect({ goto: 'confirmation' })],
          },
        }),
      ],
    }),
    step({
      code: 'confirmation',
      path: '/confirmation',
      title: 'Application complete',
      blocks: [GovUKHeading({ text: 'Application complete' }), GovUKButton({ text: 'Start again' })],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [ClearDraft('intro')],
            next: [redirect({ goto: 'your-name' })],
          },
        }),
      ],
    }),
  ],
})

export const browserDemoPackage = createForgePackage({ journey: browserDemoJourney })
