import { Literal, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKBody, GovUKList, GovUKLinkButton } from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({
  text: 'Task list',
  size: 'l',
  caption: 'Pattern',
})

const intro = GovUKBody({
  text: `A hub page that breaks a complex service into named tasks,
  each with a completion status. Users can complete tasks in any order
  (subject to prerequisites) and return to the hub between sections.`,
})

const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

const showsList = GovUKList({
  items: Literal([
    'A GovUKTaskList component with dynamic status tags per task',
    'Conditional hrefs that disable links when prerequisites are incomplete',
    'Status derived from answer state using nested Conditional expressions',
    'Each section redirects back to the task list after completion',
    'A gated "Check and submit" task that only unlocks when all others are done',
  ]),
  style: 'bullet',
})

const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/task-list/tasks',
  isStartButton: true,
})

export const overviewStep = step({
  path: '/overview',
  title: 'Task list',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
})
