import { step, submitTransition, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import { contactMethodField, continueButton } from './blocks'

export const contactMethodStep = step({
  path: '/contact-method',
  title: 'How should we contact you?',
  backlink: 'your-feedback',
  blocks: [contactMethodField, continueButton],
  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('feedback-form')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
