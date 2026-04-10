import {
  step,
  submitTransition,
  actionTransition,
  accessTransition,
  redirect,
  Post,
  Query,
  Condition,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../../effects'
import {heading, tripCards, buttonGroup} from './blocks'

// FORGE-EXAMPLE: This step demonstrates two key patterns:
// 1. onAccess handles removal via query string (?remove=0) with a RemoveTrip effect
// 2. onAction handles the "Add another" button via Post('action') matching
export const yourTripsStep = step({
  code: 'your-trips',
  path: '/your-trips',
  title: 'Your trips',
  onAccess: [
    accessTransition({
      when: Query('remove').match(Condition.IsRequired()),
      effects: [ExampleJourneysEffects.RemoveTrip(), ExampleJourneysEffects.SaveAnswers('travel-form')],
    }),
  ],
  blocks: [heading, tripCards, buttonGroup],
  onAction: [
    actionTransition({
      when: Post('action').match(Condition.Equals('add-another')),
      effects: [ExampleJourneysEffects.SaveAnswers('travel-form')],
    }),
  ],
  onSubmission: [
    submitTransition({
      when: Post('action').match(Condition.Equals('add-another')),
      validate: false,
      onAlways: {
        next: [redirect({ goto: 'add-trip' })],
      },
    }),
    submitTransition({
      when: Post('action').match(Condition.Equals('continue')),
      validate: false,
      onAlways: {
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
