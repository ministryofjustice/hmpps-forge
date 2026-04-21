import { Self, Condition, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKTextareaInput,
  GovUKButton,
  GovUKHeading,
  GovUKBody,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Do you have any additional needs?',
  size: 'l',
})

export const hint = GovUKBody({
  text: 'Tell us about any accessibility requirements, dietary needs, or other support you need during your visit. Enter "None" if you have no additional needs.',
})

export const additionalNeedsField = GovUKTextareaInput({
  code: 'additionalNeeds',
  label: {
    text: 'Additional needs',
    classes: GovukUtilityClasses.Label.Medium,
  },
  rows: 4,
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your additional needs or "None"',
      submissionOnly: true,
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Save and return' })
