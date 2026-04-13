import { step, submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import { heading, summaryList, confirmationBody, submitButton } from './blocks'

export const checkAnswersStep = step({
  code: 'booking-check-answers',
  path: '/check-answers',
  title: 'Check your answers before booking',
  blocks: [heading, summaryList, confirmationBody, submitButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [ExampleJourneysEffects.SaveAnswers('booking-form')],
        next: [redirect({ goto: 'confirmation' })],
      },
    }),
  ],
})
