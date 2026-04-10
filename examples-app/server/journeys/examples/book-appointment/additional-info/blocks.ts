import {
  Self,
  Answer,
  Condition,
  Transformer,
  match,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKDetails,
  GovUKTextareaInput,
  GovUKButton,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({ text: 'Additional information' })

// FORGE-EXAMPLE: GovUKDetails renders an expandable disclosure with a summary label.
// The `text` property accepts conditional expressions, so match() can tailor the
// guidance content based on the user's earlier appointment type selection.
export const whatToExpectDetails = GovUKDetails({
  summaryText: 'What to expect at your appointment',
  text: match(Answer('appointmentType'))
    .branch(
      Condition.Equals('in-person'),
      'Bring valid photo ID. Arrive 10 minutes early. The appointment will last approximately 30 minutes.',
    )
    .branch(
      Condition.Equals('phone'),
      'Make sure you are available at the phone number you provided. The call will last approximately 20 minutes.',
    )
    .branch(
      Condition.Equals('video'),
      'You will need a device with a camera and microphone. Test your setup before the appointment. The call will last approximately 20 minutes.',
    )
    .otherwise(''),
})

export const additionalInfoField = GovUKTextareaInput({
  code: 'additionalInfo',
  label: {
    text: 'Additional information (optional)',
    classes: GovukUtilityClasses.Label.Medium,
  },
  hint: {
    text: 'Tell us about any accessibility requirements or other needs we should be aware of',
  },
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.String.HasMaxLength(500)),
      message: 'Additional information must be 500 characters or less',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
