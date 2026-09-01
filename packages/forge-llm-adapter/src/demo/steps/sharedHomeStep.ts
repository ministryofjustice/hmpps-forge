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

export const sharedHomeStep = step<LlmTurnBlocks>({
  code: 'shared-home',
  path: '/shared-home',
  title: 'Your shared home',
  blocks: {
    content: [
      LlmContent({ content: 'Shared homes can take lots of forms. Tell me what your current arrangement looks like.' }),
    ],
    questions: [
      LlmSingleSelect({
        code: 'sharedHomeWith',
        prompt: 'Who do you live with?',
        options: [
          { value: 'family', text: 'Family' },
          { value: 'friends', text: 'Friends' },
          { value: 'partner', text: 'A partner' },
          { value: 'other', text: 'Someone else' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me who you share your home with',
          }),
        ],
      }),
      LlmDate({
        code: 'sharedHomeMoveInDate',
        prompt: 'When did you start living there?',
        llmHint:
          'Return a complete date as DD/MM/YYYY. Extract the date without deciding whether it is valid or in the past; Forge will validate it. Resolve exact relative dates against the current date, but never invent a missing day or month. Return null when the user has only supplied a partial or approximate date.',
        llmClarificationHint:
          'Explain impossible calendar dates plainly. Ask for the complete date they intended, including day, month and year.',
        formatters: [Transformer.String.ToISODate()],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me the full date when you started living there',
          }),
          validation({
            condition: Self().match(Condition.Date.IsValid()),
            message: 'Tell me a real date when you started living there',
          }),
          validation({
            condition: or(Self().not.match(Condition.Date.IsValid()), Self().not.match(Condition.Date.IsFutureDate())),
            message: 'The date when you started living there must not be in the future',
          }),
        ],
      }),
      LlmFreeText({
        code: 'sharedHomeExperience',
        prompt: 'What do you like about the arrangement, and what can be difficult?',
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me a little about how the arrangement works for you',
          }),
        ],
      }),
      LlmSingleSelect({
        code: 'sharedHomePlans',
        prompt: 'What do you imagine doing next?',
        options: [
          { value: 'stay', text: 'Stay where I am' },
          { value: 'move', text: 'Move somewhere else' },
          { value: 'unsure', text: 'I am not sure yet' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me what you currently imagine doing next',
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
