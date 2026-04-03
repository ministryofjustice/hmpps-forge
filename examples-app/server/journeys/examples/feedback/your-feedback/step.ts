import { step, submitTransition, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import { feedbackField, continueButton } from './blocks'

export const feedbackStep = step({
  path: '/your-feedback',
  title: 'Your feedback',
  backlink: 'name',
  blocks: [feedbackField, continueButton],
  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('feedback-form')],
        next: [redirect({ goto: 'contact-method' })],
      },
    }),
  ],
})
