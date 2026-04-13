import {
  Self,
  Data,
  Item,
  Iterator,
  Answer,
  Condition,
  Transformer,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKSelectInput,
  GovUKDateInputFull,
  GovUKRadioInput,
  GovUKTextareaInput,
  GovUKButton,
  GovUKHeading,
  GovukUtilityClasses,
  GovukValidations,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Add a trip',
  size: 'l',
})

// FORGE-EXAMPLE: The country select items are loaded from static data defined on the step
// via the `data` property. Data('countries') references step.data.countries, and
// Iterator.Map transforms each { value, text } pair into select items.
export const countryField = GovUKSelectInput({
  code: 'tripCountry',
  label: {
    text: 'Which country did you visit?',
    classes: GovukUtilityClasses.Label.Medium,
  },
  items: Data('countries').each(
    Iterator.Map({
      value: Item().path('value'),
      text: Item().path('text'),
    }),
  ),
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select a country',
      submissionOnly: true,
    }),
  ],
})

// FORGE-EXAMPLE: GovUKDateInputFull submits an object { day, month, year }.
// Transformer.Object.ToISO converts it to an ISO string (e.g. "2024-03-27") before validation.
// Field-specific validations are guarded with IsObject() because they only apply when
// ToISO failed (i.e., a field was left empty). The details: { field } metadata highlights
// the specific day/month/year input that has the error.
export const departureDateField = GovUKDateInputFull({
  code: 'tripDepartureDate',
  fieldset: {
    legend: {
      text: 'When did you leave the UK?',
      classes: GovukUtilityClasses.Fieldset.MediumLabel,
    },
  },
  hint: { text: 'For example, 27 3 2024' },
  formatters: [Transformer.Object.ToISO({ year: 'year', month: 'month', day: 'day' })],
  validWhen: [
    ...GovukValidations.DateInputFull({
      empty: { message: 'Enter a departure date', submissionOnly: true },
      missingDay: { message: 'Departure date must include a day', submissionOnly: true },
      missingMonth: { message: 'Departure date must include a month', submissionOnly: true },
      missingYear: { message: 'Departure date must include a year', submissionOnly: true },
      invalid: { message: 'Departure date must be a real date', submissionOnly: true },
      mustBePast: { message: 'Departure date must be in the past', submissionOnly: true },
    }),
  ],
})

export const returnDateField = GovUKDateInputFull({
  code: 'tripReturnDate',
  fieldset: {
    legend: {
      text: 'When did you return to the UK?',
      classes: GovukUtilityClasses.Fieldset.MediumLabel,
    },
  },
  hint: { text: 'For example, 3 4 2024' },
  formatters: [Transformer.Object.ToISO({ year: 'year', month: 'month', day: 'day' })],
  validWhen: [
    ...GovukValidations.DateInputFull({
      empty: { message: 'Enter a return date', submissionOnly: true },
      missingDay: { message: 'Return date must include a day', submissionOnly: true },
      missingMonth: { message: 'Return date must include a month', submissionOnly: true },
      missingYear: { message: 'Return date must include a year', submissionOnly: true },
      invalid: { message: 'Return date must be a real date', submissionOnly: true },
    }),
    validation({
      condition: Self().match(Condition.Date.IsAfter(Answer('tripDepartureDate'))),
      message: 'Return date must be after the departure date',
      submissionOnly: true,
    }),
  ],
})

export const reasonField = GovUKRadioInput({
  code: 'tripReason',
  fieldset: {
    legend: {
      text: 'What was the main reason for your trip?',
      classes: GovukUtilityClasses.Fieldset.MediumLabel,
    },
  },
  items: [
    { value: 'holiday', text: 'Holiday' },
    { value: 'work', text: 'Work or business' },
    { value: 'family', text: 'Visiting family or friends' },
    { value: 'education', text: 'Education or training' },
    { value: 'medical', text: 'Medical treatment' },
    {
      value: 'other',
      text: 'Other',
      block: GovUKTextareaInput({
        code: 'tripDetails',
        label: { text: 'Give details' },
        dependentWhen: Answer('tripReason').match(Condition.Equals('other')),
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter details about your trip',
            submissionOnly: true,
          }),
        ],
      }),
    },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select the main reason for your trip',
      submissionOnly: true,
    }),
  ],
})

export const continueButton = GovUKButton({ text: 'Save and continue' })
