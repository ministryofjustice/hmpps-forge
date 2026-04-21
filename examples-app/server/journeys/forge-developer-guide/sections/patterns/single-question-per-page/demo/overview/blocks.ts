import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Single question per page',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `A sequential flow that asks one question per page. Each submission is validated,
  then the user progresses to the next question. A check-your-answers page lets
  them review and change individual answers before confirming.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'One field per step with a form-level Continue button',
    'Validation rules on every submission, with inline error messages',
    'Answers persisted between steps using the session',
    'A summary page with "Change" links that return the user to the original step',
    'A final confirmation panel after submission',
  ]),
  type: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/forge-developer-guide/patterns/demos/single-question-per-page/your-name',
  isStartButton: true,
})
