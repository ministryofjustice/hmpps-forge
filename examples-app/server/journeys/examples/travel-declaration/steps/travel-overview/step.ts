import {
  step,
  submitTransition,
  redirect,
  Answer,
  Condition,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../../effects'
import { hasTravelledField, continueButton } from './blocks'

export const travelOverviewStep = step({
  code: 'travel-overview',
  path: '/travel-overview',
  title: 'Have you travelled outside the UK in the last 5 years?',
  isEntryPoint: true,
  blocks: [hasTravelledField, continueButton],
  onSubmission: [
    submitTransition({
      validate: true,
      onValid: {
        effects: [ExampleJourneysEffects.SaveAnswers('travel-form')],
        next: [
          redirect({
            when: Answer('hasTravelled').match(Condition.Equals('yes')),
            goto: 'add-trip',
          }),
          redirect({ goto: 'check-answers' }),
        ],
      },
    }),
  ],
})
