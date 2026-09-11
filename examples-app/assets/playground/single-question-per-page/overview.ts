import { step, Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({
  text: 'Single question per page',
  size: 'l',
  caption: 'Pattern',
})

const intro = GovUKBody({
  text: `A sequential flow that asks one question per page. Each submission is validated,
  then the user progresses to the next question. A check-your-answers page lets
  them review and change individual answers before confirming.`,
})

const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

const showsList = GovUKList({
  items: Literal([
    'One field per step with a form-level Continue button',
    'Validation rules on every submission, with inline error messages',
    'Answers persisted between steps using the session',
    'A summary page with "Change" links that return the user to the original step',
    'A final confirmation panel after submission',
  ]),
  style: 'bullet',
})

const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/single-question-per-page/your-name',
  isStartButton: true,
})

export const overviewStep = step({
  path: '/overview',
  title: 'Single question per page',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
})
