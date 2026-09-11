import { Literal, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKBody, GovUKList, GovUKLinkButton } from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({
  text: 'Repeating fieldsets',
  size: 'l',
  caption: 'Pattern',
})

const intro = GovUKBody({
  text: `A single page that collects a variable number of items through
  repeating groups of form fields. Each "Add another" press appends a new
  set of empty inputs. All items are editable simultaneously and submitted
  together.`,
})

const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

const showsList = GovUKList({
  items: Literal([
    'Form inputs inside an Iterator.Map with dynamic field codes',
    'A non-validating submit hook that appends an empty item and re-renders the page',
    'A remove submit hook that splices an item and re-indexes the remaining fields',
    'Session-backed collection state that survives page reloads',
  ]),
  style: 'bullet',
})

const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/repeating-fieldsets/household-members',
  isStartButton: true,
})

export const overviewStep = step({
  path: '/overview',
  title: 'Repeating fieldsets',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
})
