import {
  step,
  submitTransition,
  redirect,
  Answer,
  Condition,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import { heading, fullNameField, emailField, phoneNumberField, continueButton } from './blocks'

export const detailsStep = step({
  path: '/your-details',
  title: 'Your details',
  backlink: 'type',
  blocks: [heading, fullNameField, emailField, phoneNumberField, continueButton],
  // FORGE-EXAMPLE: Conditional routing — the next step depends on the appointment type.
  // When multiple redirects are listed, the first one whose `when` predicate matches is used.
  // A redirect without `when` acts as a fallback.
  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('booking-form')],
        next: [
          redirect({
            when: Answer('appointmentType').match(Condition.Equals('in-person')),
            goto: 'location',
          }),
          redirect({ goto: 'choose-date' }),
        ],
      },
    }),
  ],
})
