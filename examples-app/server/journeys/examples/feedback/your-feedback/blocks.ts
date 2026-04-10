import {
  Self,
  Condition,
  Transformer,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKTextareaInput,
  GovUKButton,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const feedbackField = GovUKTextareaInput({
  code: 'feedback',
  label: {
    text: 'Your feedback',
    classes: GovukUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  hint: { text: 'Do not include personal or financial information' },
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your feedback',
    }),
    validation({
      condition: Self().match(Condition.String.HasMaxLength(1200)),
      message: 'Feedback must be 1200 characters or less',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
