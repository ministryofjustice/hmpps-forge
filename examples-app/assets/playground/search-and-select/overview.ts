import { Literal, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKBody, GovUKList, GovUKLinkButton } from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({
  text: 'Search and select',
  size: 'l',
  caption: 'Pattern',
})

const intro = GovUKBody({
  text: `A search page that accepts user input, runs a query against a
  data source, and displays matching results. The user selects a
  result to view its full details. This demo searches a directory
  of London Underground stations by name.`,
})

const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

const showsList = GovUKList({
  items: Literal([
    'A text input submitted via POST that triggers a search effect on redirect',
    'CollectionBlock with Data() to render dynamic search results',
    'Loop.Item() path accessors inside an Iterator.Map to display each result',
    'A detail page that loads a specific record by route parameter',
  ]),
  style: 'bullet',
})

const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/search-and-select/search',
  isStartButton: true,
})

export const overviewStep = step({
  path: '/overview',
  title: 'Search and select',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
})
