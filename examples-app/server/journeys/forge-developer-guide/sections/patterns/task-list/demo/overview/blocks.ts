import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Task list',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `A hub page that breaks a complex service into named tasks,
  each with a completion status. Users can complete tasks in any order
  (subject to prerequisites) and return to the hub between sections.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'A GovUKTaskList component with dynamic status tags per task',
    'Conditional hrefs that disable links when prerequisites are incomplete',
    'Status derived from answer state using nested Conditional expressions',
    'Each section redirects back to the task list after completion',
    'A gated "Check and submit" task that only unlocks when all others are done',
  ]),
  type: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/forge-developer-guide/patterns/demos/task-list/tasks',
  isStartButton: true,
})
