import {
  Self,
  Data,
  Item,
  Iterator,
  Condition,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKSelectInput,
  GovUKButton,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

// FORGE-EXAMPLE: GovUKSelectInput supports ConditionalArray for its items property,
// meaning items can be loaded dynamically from Data() references at runtime.
// Here Iterator.Map() transforms each slot object from the API into a select item shape.
export const appointmentTimeField = GovUKSelectInput({
  code: 'appointmentTime',
  label: {
    text: 'Choose a time',
    classes: GovukUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  hint: { text: 'Available times are shown for your selected date' },
  items: Data('availableSlots').each(
    Iterator.Map({
      value: Item().path('time'),
      text: Item().path('time'),
    }),
  ),
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Select an appointment time',
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Continue' })
