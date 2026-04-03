import { journey, accessTransition } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../effects'
import { nameStep } from './name/step'
import { feedbackStep } from './your-feedback/step'
import { contactMethodStep } from './contact-method/step'
import { checkAnswersStep } from './check-answers/step'
import { confirmationStep } from './confirmation/step'

// FORGE-EXAMPLE: A journey groups steps into a multi-page flow with a shared path prefix.
// onAccess effects run on every GET, e.g. to load saved answers before rendering.
export const feedbackJourney = journey({
  code: 'feedback',
  title: 'Give feedback',
  path: '/feedback',
  view: {
    locals: { serviceName: 'Feedback form' },
  },
  onAccess: [
    accessTransition({
      effects: [ExampleJourneysEffects.LoadAnswers('feedback-form')],
    }),
  ],
  steps: [nameStep, feedbackStep, contactMethodStep, checkAnswersStep, confirmationStep],
})
