import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Pagination',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `A paginated list that splits a large data set across multiple
  pages. The user navigates between pages using Previous and Next
  links. This demo paginates a directory of London Underground
  stations, showing five per page.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'Reading a query parameter on access to determine the current page',
    'Slicing a data set in an effect and setting pagination metadata as Data',
    'CollectionBlock with Data() to render the current page of results',
    'Conditional Previous and Next links using visibleWhen with Data checks',
  ]),
  style: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/forge-developer-guide/patterns/demos/pagination/list',
  isStartButton: true,
})
