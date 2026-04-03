import { step, submitTransition, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../effects'
import {
  panel,
  whatHappensNextHeading,
  whatHappensNextBody,
  contactMethodInset,
  startAgainButton,
} from './blocks'

export const confirmationStep = step({
  path: '/confirmation',
  title: 'Feedback sent',
  blocks: [
    panel,
    whatHappensNextHeading,
    whatHappensNextBody,
    contactMethodInset,
    startAgainButton,
  ],
  onSubmission: [
    submitTransition({
      validate: false,
      onAlways: {
        effects: [ExampleJourneysEffects.ClearAnswers('feedback-form')],
        next: [redirect({ goto: 'name' })],
      },
    }),
  ],
})
