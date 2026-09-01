import {
  or,
  redirect,
  Self,
  step,
  submit,
  Transformer,
  validation,
  Condition,
} from '@ministryofjustice/hmpps-forge/core/authoring'

import { LlmContent } from '../../functions/components/content/llmContent'
import { LlmDate } from '../../functions/components/date/llmDate'
import { LlmFreeText } from '../../functions/components/free-text/llmFreeText'
import { LlmMultiSelect } from '../../functions/components/multi-select/llmMultiSelect'
import { LlmSingleSelect } from '../../functions/components/single-select/llmSingleSelect'
import type { LlmTurnBlocks } from '../../functions/renderers/turn/llmTurn'
import { SaveLlmDemoAnswers } from '../llmDemoJourneyEffects'

export const ownerDetailsStep = step<LlmTurnBlocks>({
  code: 'owner-details',
  path: '/owner-details',
  title: 'Your property',
  blocks: {
    content: [
      LlmContent({
        content: 'It would be lovely to get a picture of the home you own. Feel free to describe it naturally.',
      }),
    ],
    questions: [
      LlmSingleSelect({
        code: 'ownedPropertyType',
        prompt: 'What kind of property is it?',
        options: [
          { value: 'house', text: 'House' },
          { value: 'flat', text: 'Flat or apartment' },
          { value: 'bungalow', text: 'Bungalow' },
          { value: 'other', text: 'Another kind of property' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me what kind of property you own',
          }),
        ],
      }),
      LlmFreeText({
        code: 'propertyColour',
        prompt: 'How would you describe its colour?',
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me what colour the property is',
          }),
        ],
      }),
      LlmDate({
        code: 'purchaseDate',
        prompt: 'When did you buy it?',
        llmHint:
          'Return a complete date as DD/MM/YYYY. Extract the date without deciding whether it is valid or in the past; Forge will validate it. Resolve exact relative dates against the current date, but never invent a missing day or month. Return null when the user has only supplied a partial or approximate date.',
        llmClarificationHint:
          'Explain impossible calendar dates plainly. Ask for the complete date they intended, including day, month and year.',
        formatters: [Transformer.String.ToISODate()],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me the full date when you bought the property',
          }),
          validation({
            condition: Self().match(Condition.Date.IsValid()),
            message: 'Tell me a real purchase date',
          }),
          validation({
            condition: or(Self().not.match(Condition.Date.IsValid()), Self().not.match(Condition.Date.IsFutureDate())),
            message: 'The purchase date must not be in the future',
          }),
        ],
      }),
      LlmMultiSelect({
        code: 'propertyFeatures',
        prompt: 'Which of these features does it have?',
        options: [
          { value: 'garden', text: 'Garden' },
          { value: 'garage', text: 'Garage' },
          { value: 'driveway', text: 'Driveway' },
          { value: 'balcony', text: 'Balcony' },
          { value: 'spare-room', text: 'Spare room' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me which features the property has',
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
        next: [redirect({ goto: 'owner-plans' })],
      },
    }),
  ],
})
