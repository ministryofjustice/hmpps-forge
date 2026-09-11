import { Literal, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKBody, GovUKList, GovUKLinkButton } from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({
  text: 'Pagination',
  size: 'l',
  caption: 'Pattern',
})

const intro = GovUKBody({
  text: `A paginated list that splits a large data set across multiple
  pages. The user navigates between pages using Previous and Next
  links. This demo paginates a directory of London Underground
  stations, showing five per page.`,
})

const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

const showsList = GovUKList({
  items: Literal([
    'Reading a query parameter on access to determine the current page',
    'Slicing a data set in an effect and setting pagination metadata as Data',
    'CollectionBlock with Data() to render the current page of results',
    'Conditional Previous and Next links using visibleWhen with Data checks',
  ]),
  style: 'bullet',
})

const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/pagination/list',
  isStartButton: true,
})

export const overviewStep = step({
  path: '/overview',
  title: 'Pagination',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
})
