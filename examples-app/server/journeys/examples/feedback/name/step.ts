import { step, submitTransition, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import { fullNameField, continueButton } from './blocks'

export const nameStep = step({
  path: '/name',
  title: 'What is your name?',
  isEntryPoint: true,
  blocks: [fullNameField, continueButton],
  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('feedback-form')],
        next: [redirect({ goto: 'your-feedback' })],
      },
    }),
  ],
})
