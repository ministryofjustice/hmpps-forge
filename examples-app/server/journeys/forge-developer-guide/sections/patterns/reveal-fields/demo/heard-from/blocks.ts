import {
  Self,
  Answer,
  Condition,
  Transformer,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKRadioInput,
  GovUKTextInput,
  GovUKButton,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

// Each radio item can carry a `block` that the GOV.UK radios template renders
// inside a conditional reveal. Nested fields use `dependentWhen` so their value
// and validation only apply when the parent option is the selected answer - if
// the user picks a different option, the reveal's input is ignored even if a
// stale value exists in the session.
export const heardFromField = GovUKRadioInput({
  code: 'heardFrom',
  fieldset: {
    legend: {
      text: 'How did you hear about us?',
      classes: GovUKUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  items: [
    { value: 'search-engine', text: 'Search engine' },
    {
      value: 'social-media',
      text: 'Social media',
      block: GovUKTextInput({
        code: 'socialMediaSource',
        label: 'Which platform?',
        dependentWhen: Answer('heardFrom').match(Condition.Equals('social-media')),
        classes: GovUKUtilityClasses.Input.Width20,
        formatters: [Transformer.String.Trim()],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter the platform where you saw us',
          }),
        ],
      }),
    },
    { value: 'friend-or-colleague', text: 'Friend or colleague' },
    {
      value: 'other',
      text: 'Other',
      block: GovUKTextInput({
        code: 'otherSource',
        label: 'Please specify',
        dependentWhen: Answer('heardFrom').match(Condition.Equals('other')),
        classes: GovUKUtilityClasses.Input.Width20,
        formatters: [Transformer.String.Trim()],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter where you heard about us',
          }),
        ],
      }),
    },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select how you heard about us',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
