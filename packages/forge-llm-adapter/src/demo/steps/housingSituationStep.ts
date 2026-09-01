import {
  Answer,
  Condition,
  redirect,
  Self,
  step,
  submit,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'

import { LlmContent } from '../../functions/components/content/llmContent'
import { LlmSingleSelect } from '../../functions/components/single-select/llmSingleSelect'
import type { LlmTurnBlocks } from '../../functions/renderers/turn/llmTurn'
import { SaveLlmDemoAnswers } from '../llmDemoJourneyEffects'

export const housingSituationStep = step<LlmTurnBlocks>({
  code: 'housing-situation',
  path: '/housing-situation',
  title: 'Current housing situation',
  reachability: { entryWhen: true },
  blocks: {
    content: [
      LlmContent({
        content:
          'To get us started, tell me about the place you currently call home. Do you own it, rent it, live with family or friends, or is your situation a little different?',
      }),
    ],
    questions: [
      LlmSingleSelect({
        code: 'housingSituation',
        prompt: 'Which best describes your current housing situation?',
        llmHint:
          'Return a value only when the user states or unambiguously implies their tenure. A property type, location, or description of the home does not distinguish owning, renting, living with family or friends, or another arrangement, so return null in that case.',
        options: [
          { value: 'owner', text: 'I own my home' },
          { value: 'renter', text: 'I rent my home' },
          { value: 'family-or-friends', text: 'I live with family or friends' },
          { value: 'other', text: 'Something else' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me which housing situation best describes you',
          }),
        ],
      }),
    ],
  },
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [SaveLlmDemoAnswers()],
        next: [
          redirect({ when: Answer('housingSituation').match(Condition.Equals('owner')), goto: 'owner-details' }),
          redirect({ when: Answer('housingSituation').match(Condition.Equals('renter')), goto: 'renter-details' }),
          redirect({
            when: Answer('housingSituation').match(Condition.Equals('family-or-friends')),
            goto: 'shared-home',
          }),
          redirect({ goto: 'other-housing' }),
        ],
      },
    }),
  ],
})
