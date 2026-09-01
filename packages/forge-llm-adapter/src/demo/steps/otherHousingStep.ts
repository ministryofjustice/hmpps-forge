import {
  Condition,
  or,
  redirect,
  Self,
  step,
  submit,
  Transformer,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'

import { LlmContent } from '../../functions/components/content/llmContent'
import { LlmDate } from '../../functions/components/date/llmDate'
import { LlmFreeText } from '../../functions/components/free-text/llmFreeText'
import { LlmSingleSelect } from '../../functions/components/single-select/llmSingleSelect'
import type { LlmTurnBlocks } from '../../functions/renderers/turn/llmTurn'
import { SaveLlmDemoAnswers } from '../llmDemoJourneyEffects'

export const otherHousingStep = step<LlmTurnBlocks>({
  code: 'other-housing',
  path: '/other-housing',
  title: 'Your housing arrangement',
  blocks: {
    content: [
      LlmContent({
        content: 'Housing does not always fit into a neat category, so describe your situation in your own words.',
      }),
    ],
    questions: [
      LlmFreeText({
        code: 'otherHousingDescription',
        prompt: 'What does your current housing arrangement look like?',
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me a little about your housing arrangement',
          }),
        ],
      }),
      LlmDate({
        code: 'otherHousingStartDate',
        prompt: 'When did this arrangement begin?',
        llmHint:
          'Return a complete date as DD/MM/YYYY. Extract the date without deciding whether it is valid or in the past; Forge will validate it. Resolve exact relative dates against the current date, but never invent a missing day or month. Return null when the user has only supplied a partial or approximate date.',
        llmClarificationHint:
          'Explain impossible calendar dates plainly. Ask for the complete date they intended, including day, month and year.',
        formatters: [Transformer.String.ToISODate()],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me the full date when this arrangement began',
          }),
          validation({
            condition: Self().match(Condition.Date.IsValid()),
            message: 'Tell me a real date when this arrangement began',
          }),
          validation({
            condition: or(Self().not.match(Condition.Date.IsValid()), Self().not.match(Condition.Date.IsFutureDate())),
            message: 'The date when this arrangement began must not be in the future',
          }),
        ],
      }),
      LlmSingleSelect({
        code: 'otherHousingStability',
        prompt: 'How settled does the arrangement feel?',
        options: [
          { value: 'stable', text: 'Stable' },
          { value: 'temporary', text: 'Temporary' },
          { value: 'unsure', text: 'Uncertain' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me how settled the arrangement feels',
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
