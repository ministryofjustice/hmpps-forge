import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Multi-part composite fields',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `Fields that are conceptually one value, but collected
  through several inputs. Two common flavours turn up: a
  component that owns the composition internally (date of
  birth), and separate fields laid out together that the author
  composes at display time (a postal address).`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'A component-owned composite with GovUKDateInputFull (day, month, year) that outputs one ISO date',
    'Pre-built field-specific validations for empty, missing part, and invalid date errors',
    'An author-owned composite where several text inputs on one step describe one address',
    'A summary list that formats the date and renders the address as multi-line output',
    'Optional fields that only contribute to the composed display when filled in',
  ]),
  style: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/forge-developer-guide/patterns/demos/composite-fields/date-of-birth',
  isStartButton: true,
})
