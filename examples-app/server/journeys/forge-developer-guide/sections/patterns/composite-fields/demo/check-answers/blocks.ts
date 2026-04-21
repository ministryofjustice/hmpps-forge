import { Answer, Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKSummaryList,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { NunjucksGenerators } from '@ministryofjustice/hmpps-forge/express-nunjucks'

export const heading = GovUKHeading({
  text: 'Check your answers',
})

// Date of birth comes out of GovUKDateInputFull as an ISO string. ToDate() parses
// it and Transformer.Date.Format renders a friendly long-date for display. The
// underlying answer is untouched - the transform happens at render time.
const dateOfBirthDisplay = Answer('dateOfBirth').pipe(
  Transformer.String.ToDate(),
  Transformer.Date.Format('D MMMM YYYY'),
)

// The address is 4 separate answers that the author composes here.
// NunjucksGenerators.String renders a small template with autoescape on, so
// {{ line1 }} etc. are HTML-escaped automatically and the optional line 2 is
// gated with a plain {% if %}. Forge evaluates the Answer() references in
// `data` before the template runs, so the template just sees strings.
const addressDisplay = NunjucksGenerators.String({
  template: `
    {{ line1 }}<br>
    {% if line2 %}{{ line2 }}<br>{% endif %}
    {{ town }}<br>
    {{ postcode }}
  `,
  data: {
    line1: Answer('addressLine1'),
    line2: Answer('addressLine2'),
    town: Answer('addressTown'),
    postcode: Answer('addressPostcode'),
  },
})

export const summaryList = GovUKSummaryList({
  rows: [
    {
      key: { text: 'Date of birth' },
      value: { text: dateOfBirthDisplay },
      actions: {
        items: [{ href: 'date-of-birth', text: 'Change', visuallyHiddenText: 'date of birth' }],
      },
    },
    {
      key: { text: 'Address' },
      value: { html: addressDisplay },
      actions: {
        items: [{ href: 'address', text: 'Change', visuallyHiddenText: 'address' }],
      },
    },
  ],
})

export const confirmBody = GovUKBody({
  text: 'Selecting "Confirm" will save your answers.',
})

export const submitButton = GovUKButton({ text: 'Confirm' })
