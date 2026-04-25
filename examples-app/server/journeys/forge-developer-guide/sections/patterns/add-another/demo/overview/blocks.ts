import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Adding, editing and deleting from collections',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `A list page that lets users build a collection one item
  at a time. Each item is collected on a separate form page, then
  displayed as a summary card with change and remove links. The
  user can add items, edit existing ones, remove items through a
  confirmation step, or continue to check their answers.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'A list page that renders items using CollectionBlock and Iterator.Map',
    'An "Add another" button that loops back to the form without validation',
    'Change links that pre-fill the edit page from the existing item',
    'Remove links that navigate to a confirmation page before deleting',
    'Submit hooks that route "add another" and "continue" to different steps',
    'A fallback message when the collection is empty',
  ]),
  type: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/forge-developer-guide/patterns/demos/add-another/your-contacts',
  isStartButton: true,
})
