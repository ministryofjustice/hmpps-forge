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

export const ownerPlansStep = step<LlmTurnBlocks>({
  code: 'owner-plans',
  path: '/owner-plans',
  title: 'Plans for your property',
  blocks: {
    content: [
      LlmContent({
        content: 'Now that I know a little about the place, I am curious about what comes next for you.',
      }),
    ],
    questions: [
      LlmSingleSelect({
        code: 'plansHomeChanges',
        prompt: 'Are you planning any changes or improvements to the property?',
        options: [
          { value: 'yes', text: 'Yes' },
          { value: 'no', text: 'No' },
          { value: 'unsure', text: 'I am not sure yet' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me whether you are considering any changes',
          }),
        ],
      }),
      LlmSingleSelect({
        code: 'expectedTimeAtHome',
        prompt: 'How long do you imagine staying there?',
        options: [
          { value: 'under-one-year', text: 'Less than a year' },
          { value: 'one-to-three-years', text: 'One to three years' },
          { value: 'longer-than-three-years', text: 'Longer than three years' },
          { value: 'unsure', text: 'I am not sure' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me how long you think you might stay there',
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
          redirect({
            when: Answer('plansHomeChanges').match(Condition.Equals('yes')),
            goto: 'home-improvements',
          }),
          redirect({ goto: 'housing-priorities' }),
        ],
      },
    }),
  ],
})
