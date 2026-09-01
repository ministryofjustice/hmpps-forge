import { Condition, redirect, Self, step, submit, validation } from '@ministryofjustice/hmpps-forge/core/authoring'

import { LlmContent } from '../../functions/components/content/llmContent'
import { LlmFreeText } from '../../functions/components/free-text/llmFreeText'
import { LlmMultiSelect } from '../../functions/components/multi-select/llmMultiSelect'
import type { LlmTurnBlocks } from '../../functions/renderers/turn/llmTurn'
import { SaveLlmDemoAnswers } from '../llmDemoJourneyEffects'

export const homeImprovementsStep = step<LlmTurnBlocks>({
  code: 'home-improvements',
  path: '/home-improvements',
  title: 'Home improvements',
  blocks: {
    content: [
      LlmContent({
        content: 'That sounds interesting. Tell me a little about what you would like to change.',
      }),
    ],
    questions: [
      LlmFreeText({
        code: 'plannedImprovements',
        prompt: 'What improvements do you have in mind?',
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me what you would like to improve',
          }),
        ],
      }),
      LlmFreeText({
        code: 'improvementTimeframe',
        prompt: 'When would you like the work to happen?',
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me roughly when you would like the work to happen',
          }),
        ],
      }),
      LlmMultiSelect({
        code: 'improvementAreas',
        prompt: 'Which parts of the home would the work involve?',
        options: [
          { value: 'kitchen', text: 'Kitchen' },
          { value: 'bathroom', text: 'Bathroom' },
          { value: 'garden', text: 'Garden' },
          { value: 'energy-efficiency', text: 'Energy efficiency' },
          { value: 'accessibility', text: 'Accessibility' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me which parts of the home the work would involve',
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
