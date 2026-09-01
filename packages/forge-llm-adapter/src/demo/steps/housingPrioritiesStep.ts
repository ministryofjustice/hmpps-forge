import { Condition, redirect, Self, step, submit, validation } from '@ministryofjustice/hmpps-forge/core/authoring'

import { LlmContent } from '../../functions/components/content/llmContent'
import { LlmFreeText } from '../../functions/components/free-text/llmFreeText'
import { LlmMultiSelect } from '../../functions/components/multi-select/llmMultiSelect'
import { LlmSingleSelect } from '../../functions/components/single-select/llmSingleSelect'
import type { LlmTurnBlocks } from '../../functions/renderers/turn/llmTurn'
import { SaveLlmDemoAnswers } from '../llmDemoJourneyEffects'

export const housingPrioritiesStep = step<LlmTurnBlocks>({
  code: 'housing-priorities',
  path: '/housing-priorities',
  title: 'What matters in a home',
  blocks: {
    content: [
      LlmContent({
        content: 'We are nearly done. I would like to finish with what makes somewhere feel right for you.',
      }),
    ],
    questions: [
      LlmMultiSelect({
        code: 'housingPriorities',
        prompt: 'Which things matter most when you think about a home?',
        options: [
          { value: 'affordability', text: 'Affordability' },
          { value: 'location', text: 'Location' },
          { value: 'space', text: 'Space' },
          { value: 'accessibility', text: 'Accessibility' },
          { value: 'outdoor-space', text: 'Outdoor space' },
          { value: 'public-transport', text: 'Public transport' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me which things matter most in a home',
          }),
        ],
      }),
      LlmFreeText({
        code: 'idealHomeDescription',
        prompt: 'If you could design the right home for your life, what would it be like?',
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Describe what the right home would be like for you',
          }),
        ],
      }),
      LlmSingleSelect({
        code: 'movingTimeframe',
        prompt: 'Do you think you might move in the future?',
        options: [
          { value: 'within-one-year', text: 'Within a year' },
          { value: 'one-to-three-years', text: 'In one to three years' },
          { value: 'later', text: 'Later than that' },
          { value: 'no-plans', text: 'I have no plans to move' },
          { value: 'unsure', text: 'I am not sure' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me whether moving might be part of your future',
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
        next: [redirect({ goto: 'summary' })],
      },
    }),
  ],
})
