import { step, submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import { feedbackField, continueButton } from './blocks'

export const feedbackStep = step({
  code: 'your-feedback',
  path: '/your-feedback',
  title: 'Your feedback',
  blocks: [feedbackField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('feedback-form')],
        next: [redirect({ goto: 'contact-method' })],
      },
    }),
  ],
})
