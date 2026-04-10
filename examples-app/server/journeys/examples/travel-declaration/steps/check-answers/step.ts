import {
  step,
  submitTransition,
  redirect,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../../effects'
import {
  heading,
  overviewSummary,
  tripSummaryCards,
  confirmationBody,
  submitButton,
} from './blocks'

export const checkAnswersStep = step({
  code: 'check-answers',
  path: '/check-answers',
  title: 'Check your travel declaration',
  blocks: [heading, overviewSummary, tripSummaryCards, confirmationBody, submitButton],
  onSubmission: [
    submitTransition({
      validate: false,
      onAlways: {
        next: [redirect({ goto: 'confirmation' })],
      },
    }),
  ],
})
