import { step, submitTransition, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import { locationField, continueButton } from './blocks'

export const locationStep = step({
  path: '/location',
  title: 'Which office would you like to visit?',
  backlink: 'your-details',
  blocks: [locationField, continueButton],
  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('booking-form')],
        next: [redirect({ goto: 'choose-date' })],
      },
    }),
  ],
})
