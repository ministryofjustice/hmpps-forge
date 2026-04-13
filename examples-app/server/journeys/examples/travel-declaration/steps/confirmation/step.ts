import { step, submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../../effects'
import { panel, whatHappensNextHeading, nextStepsBody, startAgainButton } from './blocks'

export const confirmationStep = step({
  code: 'confirmation',
  path: '/confirmation',
  title: 'Travel declaration submitted',
  blocks: [panel, whatHappensNextHeading, nextStepsBody, startAgainButton],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [ExampleJourneysEffects.ClearAnswers('travel-form')],
        next: [redirect({ goto: 'travel-overview' })],
      },
    }),
  ],
})
