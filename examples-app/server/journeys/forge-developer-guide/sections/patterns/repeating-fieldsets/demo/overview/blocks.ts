import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Repeating fieldsets',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `A single page that collects a variable number of items through
  repeating groups of form fields. Each "Add another" press appends a new
  set of empty inputs. All items are editable simultaneously and submitted
  together.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'Form inputs inside an Iterator.Map with dynamic field codes',
    'A non-validating submit hook that appends an empty item and re-renders the page',
    'A remove submit hook that splices an item and re-indexes the remaining fields',
    'Session-backed collection state that survives page reloads',
  ]),
  type: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'See the demo',
  href: '/forge-developer-guide/patterns/demos/repeating-fieldsets/household-members',
  isStartButton: true,
})
