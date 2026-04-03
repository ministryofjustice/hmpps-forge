import { step, submitTransition, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import { heading, summaryList, confirmationBody, submitButton } from './blocks'

export const checkAnswersStep = step({
  path: '/check-answers',
  title: 'Check your answers before booking',
  backlink: 'additional-info',
  blocks: [heading, summaryList, confirmationBody, submitButton],
  onSubmission: [
    submitTransition({
      validate: false,
      onAlways: {
        effects: [ExampleJourneysEffects.SaveAnswers('booking-form')],
        next: [redirect({ goto: 'confirmation' })],
      },
    }),
  ],
})
