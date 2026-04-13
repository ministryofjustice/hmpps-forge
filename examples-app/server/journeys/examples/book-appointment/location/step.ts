import { step, submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import { locationField, continueButton } from './blocks'

export const locationStep = step({
  code: 'location',
  path: '/location',
  title: 'Which office would you like to visit?',
  blocks: [locationField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('booking-form')],
        next: [redirect({ goto: 'choose-date' })],
      },
    }),
  ],
})
