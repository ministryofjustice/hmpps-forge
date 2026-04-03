import { GovUKHeading } from '@ministryofjustice/hmpps-forge/govuk-components'
import { MOJCardGroup } from '@ministryofjustice/hmpps-forge/moj-components'

export const heading = GovUKHeading({
  text: 'Example journeys',
})

export const journeyCards = MOJCardGroup({
  items: [
    {
      heading: 'Give feedback',
      href: 'feedback/name',
      description:
        'A simple multi-step form with text inputs, radio buttons, conditional fields, and a check-your-answers page.',
    },
    {
      heading: 'Book an appointment',
      href: 'book-appointment/type',
      description:
        'A more advanced journey with date pickers, conditional routing, data-driven selects loaded from an API, and dynamic content using match expressions.',
    },
  ],
  columns: 2,
})
