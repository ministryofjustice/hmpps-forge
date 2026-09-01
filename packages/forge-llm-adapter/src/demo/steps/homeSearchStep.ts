import { Condition, redirect, Self, step, submit, validation } from '@ministryofjustice/hmpps-forge/core/authoring'

import { LlmContent } from '../../functions/components/content/llmContent'
import { LlmFreeText } from '../../functions/components/free-text/llmFreeText'
import { LlmMultiSelect } from '../../functions/components/multi-select/llmMultiSelect'
import type { LlmTurnBlocks } from '../../functions/renderers/turn/llmTurn'
import { SaveLlmDemoAnswers } from '../llmDemoJourneyEffects'

export const homeSearchStep = step<LlmTurnBlocks>({
  code: 'home-search',
  path: '/home-search',
  title: 'Your future home',
  blocks: {
    content: [
      LlmContent({
        content: 'Let us imagine that future home for a moment. There are no wrong answers here.',
      }),
    ],
    questions: [
      LlmFreeText({
        code: 'preferredArea',
        prompt: 'Where would you ideally like to buy?',
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me where you would ideally like to buy',
          }),
        ],
      }),
      LlmFreeText({
        code: 'targetPurchaseTimeframe',
        prompt: 'When would you hope to buy?',
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me roughly when you hope to buy',
          }),
        ],
      }),
      LlmMultiSelect({
        code: 'desiredPropertyFeatures',
        prompt: 'Which features would matter in the home you buy?',
        options: [
          { value: 'garden', text: 'Garden' },
          { value: 'parking', text: 'Parking' },
          { value: 'home-office', text: 'Home office' },
          { value: 'accessible', text: 'Accessible features' },
          { value: 'near-public-transport', text: 'Near public transport' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me which features would matter in a future home',
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
        next: [redirect({ goto: 'housing-priorities' })],
      },
    }),
  ],
})
