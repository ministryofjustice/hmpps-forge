import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Search and select',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `A search page that accepts user input, runs a query against a
  data source, and displays matching results. The user selects a
  result to view its full details. This demo searches a directory
  of London Underground stations by name.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'A text input submitted via POST that triggers a search effect on redirect',
    'CollectionBlock with Data() to render dynamic search results',
    'Item() path accessors inside an Iterator.Map to display each result',
    'A detail page that loads a specific record by route parameter',
  ]),
  style: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/forge-developer-guide/patterns/demos/search-and-select/search',
  isStartButton: true,
})
