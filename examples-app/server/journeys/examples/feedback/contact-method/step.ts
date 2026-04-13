import { step, submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import { contactMethodField, continueButton } from './blocks'

export const contactMethodStep = step({
  code: 'contact-method',
  path: '/contact-method',
  title: 'How should we contact you?',
  blocks: [contactMethodField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('feedback-form')],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
