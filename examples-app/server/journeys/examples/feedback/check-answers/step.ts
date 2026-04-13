import { step, submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import { heading, summaryList, confirmationBody, submitButton } from './blocks'

export const checkAnswersStep = step({
  code: 'feedback-check-answers',
  path: '/check-answers',
  title: 'Check your answers before sending your feedback',
  blocks: [heading, summaryList, confirmationBody, submitButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [ExampleJourneysEffects.SaveAnswers('feedback-form')],
        next: [redirect({ goto: 'confirmation' })],
      },
    }),
  ],
})
