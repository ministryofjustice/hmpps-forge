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
import { LlmFreeText } from '../../functions/components/free-text/llmFreeText'
import { LlmSingleSelect } from '../../functions/components/single-select/llmSingleSelect'
import type { LlmTurnBlocks } from '../../functions/renderers/turn/llmTurn'
import { SaveLlmDemoAnswers } from '../llmDemoJourneyEffects'

export const renterPlansStep = step<LlmTurnBlocks>({
  code: 'renter-plans',
  path: '/renter-plans',
  title: 'Your future plans',
  blocks: {
    content: [
      LlmContent({
        content: 'Thinking a little further ahead, I would like to understand how the current place fits your plans.',
      }),
    ],
    questions: [
      LlmFreeText({
        code: 'rentalExperience',
        prompt: 'What works well about renting there, and what would you change?',
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me what works well and what you might change',
          }),
        ],
      }),
      LlmSingleSelect({
        code: 'plansToBuy',
        prompt: 'Do you think you would like to buy a home?',
        options: [
          { value: 'yes', text: 'Yes' },
          { value: 'no', text: 'No' },
          { value: 'unsure', text: 'I am not sure yet' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me whether buying a home is in your plans',
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
          redirect({ when: Answer('plansToBuy').match(Condition.Equals('yes')), goto: 'home-search' }),
          redirect({ goto: 'housing-priorities' }),
        ],
      },
    }),
  ],
})
