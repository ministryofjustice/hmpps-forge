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
import { LlmMultiSelect } from '../../functions/components/multi-select/llmMultiSelect'
import { LlmSingleSelect } from '../../functions/components/single-select/llmSingleSelect'
import type { LlmTurnBlocks } from '../../functions/renderers/turn/llmTurn'
import { SaveLlmDemoAnswers } from '../llmDemoJourneyEffects'

export const renterDetailsStep = step<LlmTurnBlocks>({
  code: 'renter-details',
  path: '/renter-details',
  title: 'Your rented home',
  blocks: {
    content: [
      LlmContent({ content: 'Thanks. Tell me a little about the place you rent and what the arrangement is like.' }),
    ],
    questions: [
      LlmSingleSelect({
        code: 'rentedPropertyType',
        prompt: 'What kind of property do you rent?',
        llmHint:
          'The words flat or apartment in any earlier user message answer this question as flat, including when the user described the property before clarifying that they rent it. Return null when the user has not identified a property type.',
        options: [
          { value: 'house', text: 'House' },
          { value: 'flat', text: 'Flat or apartment' },
          { value: 'room', text: 'A room in a shared property' },
          { value: 'other', text: 'Another kind of property' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me what kind of property you rent',
          }),
        ],
      }),
      LlmDate({
        code: 'rentalMoveInDate',
        prompt: 'When did you move in?',
        llmHint:
          'Return a complete date as DD/MM/YYYY. Extract the date without deciding whether it is valid or in the past; Forge will validate it. Resolve exact relative dates against the current date, but never invent a missing day or month. Return null when the user has only supplied a partial or approximate date.',
        llmClarificationHint:
          'Explain impossible calendar dates plainly. Ask for the complete date they intended, including day, month and year.',
        formatters: [Transformer.String.ToISODate()],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me the full date when you moved in',
          }),
          validation({
            condition: Self().match(Condition.Date.IsValid()),
            message: 'Tell me a real move-in date',
          }),
          validation({
            condition: or(Self().not.match(Condition.Date.IsValid()), Self().not.match(Condition.Date.IsFutureDate())),
            message: 'The move-in date must not be in the future',
          }),
        ],
      }),
      LlmSingleSelect({
        code: 'rentalFurnishing',
        prompt: 'Was it furnished when you moved in?',
        options: [
          { value: 'furnished', text: 'Furnished' },
          { value: 'part-furnished', text: 'Part-furnished' },
          { value: 'unfurnished', text: 'Unfurnished' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me whether the property was furnished',
          }),
        ],
      }),
      LlmMultiSelect({
        code: 'rentalFeatures',
        prompt: 'Which useful features are included?',
        options: [
          { value: 'outdoor-space', text: 'Outdoor space' },
          { value: 'parking', text: 'Parking' },
          { value: 'accessible', text: 'Accessible features' },
          { value: 'allows-pets', text: 'Pets are allowed' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me which useful features are included',
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
        next: [redirect({ goto: 'renter-plans' })],
      },
    }),
  ],
})
