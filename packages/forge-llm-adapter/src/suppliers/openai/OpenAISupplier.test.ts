import type { LlmResolveTurnRequest } from '../../conversation/LlmConversation'
import { OpenAISupplier, type OpenAIResponsesClient } from './OpenAISupplier'

const request: LlmResolveTurnRequest = {
  messages: [
    { role: 'assistant', content: 'Tell me about your property.' },
    { role: 'user', content: 'I bought my blue property in 2025 and it has a garage.' },
  ],
  turn: {
    content: [],
    questions: [
      {
        kind: 'single-select',
        code: 'ownsProperty',
        prompt: 'Do you own a property?',
        options: [
          { value: 'yes', text: 'Yes' },
          { value: 'no', text: 'No' },
        ],
        errors: [],
      },
      {
        kind: 'multi-select',
        code: 'propertyFeatures',
        prompt: 'Which features does it have?',
        options: [
          { value: 'garden', text: 'Garden' },
          { value: 'garage', text: 'Garage' },
        ],
        value: [],
        errors: [],
      },
      {
        kind: 'date',
        code: 'purchaseDate',
        prompt: 'When did you buy it?',
        llmHint: 'Return YYYY, YYYY-MM or YYYY-MM-DD.',
        errors: [],
      },
    ],
  },
  priorAnswers: [
    {
      path: '/property/housing-situation',
      question: {
        kind: 'single-select',
        code: 'housingSituation',
        prompt: 'Which best describes your housing situation?',
        options: [
          { value: 'owner', text: 'Owner' },
          { value: 'renter', text: 'Renter' },
        ],
        errors: [],
      },
      answer: 'renter',
    },
  ],
}

describe('OpenAISupplier', () => {
  describe('resolveTurn()', () => {
    it('should resolve answers using strict Responses API structured output', async () => {
      // Arrange
      const create = vi.fn<OpenAIResponsesClient['responses']['create']>().mockResolvedValue({
        output_text: JSON.stringify({
          answers: {
            ownsProperty: 'yes',
            propertyFeatures: ['garage'],
            purchaseDate: '2025',
          },
          amendments: {
            housingSituation: 'owner',
          },
          interaction: {
            kind: 'answer',
            message: null,
          },
        }),
      })
      const supplier = new OpenAISupplier(
        { apiKey: 'test-key', model: 'gpt-test', reasoningEffort: 'low' },
        { responses: { create } },
      )

      // Act
      const result = await supplier.resolveTurn(request)

      // Assert
      expect(create).toHaveBeenCalledWith({
        model: 'gpt-test',
        reasoning: { effort: 'low' },
        instructions: expect.stringContaining(
          "Choose a selection option only when the user's words distinguish it from the other available options.",
        ),
        input: [
          {
            role: 'developer',
            content: expect.stringContaining('"code":"purchaseDate"'),
          },
          { role: 'assistant', content: 'Tell me about your property.' },
          { role: 'user', content: 'I bought my blue property in 2025 and it has a garage.' },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'forge_turn_answers',
            description: 'Answers inferred for the current Forge turn.',
            schema: {
              type: 'object',
              properties: {
                answers: {
                  type: 'object',
                  properties: {
                    ownsProperty: {
                      anyOf: [{ type: 'string', enum: ['yes', 'no'] }, { type: 'null' }],
                    },
                    propertyFeatures: {
                      anyOf: [
                        {
                          type: 'array',
                          items: { type: 'string', enum: ['garden', 'garage'] },
                        },
                        { type: 'null' },
                      ],
                    },
                    purchaseDate: {
                      description: 'Return YYYY, YYYY-MM or YYYY-MM-DD.',
                      anyOf: [{ type: 'string' }, { type: 'null' }],
                    },
                  },
                  required: ['ownsProperty', 'propertyFeatures', 'purchaseDate'],
                  additionalProperties: false,
                },
                amendments: {
                  type: 'object',
                  properties: {
                    housingSituation: {
                      anyOf: [{ type: 'string', enum: ['owner', 'renter'] }, { type: 'null' }],
                    },
                  },
                  required: ['housingSituation'],
                  additionalProperties: false,
                },
                interaction: {
                  type: 'object',
                  properties: {
                    kind: { type: 'string', enum: ['answer', 'clarification'] },
                    message: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  },
                  required: ['kind', 'message'],
                  additionalProperties: false,
                },
              },
              required: ['answers', 'amendments', 'interaction'],
              additionalProperties: false,
            },
            strict: true,
          },
          verbosity: 'low',
        },
        store: false,
      })
      expect(result).toEqual({
        answers: {
          ownsProperty: 'yes',
          propertyFeatures: ['garage'],
          purchaseDate: '2025',
        },
        amendments: { housingSituation: 'owner' },
        interaction: { kind: 'answer' },
      })
    })

    it('should omit questions that OpenAI returns as null', async () => {
      // Arrange
      const client: OpenAIResponsesClient = {
        responses: {
          create: vi.fn().mockResolvedValue({
            output_text: JSON.stringify({
              answers: {
                ownsProperty: 'yes',
                propertyFeatures: null,
                purchaseDate: null,
              },
              amendments: {
                housingSituation: null,
              },
              interaction: {
                kind: 'answer',
                message: null,
              },
            }),
          }),
        },
      }
      const supplier = new OpenAISupplier({}, client)

      // Act
      const result = await supplier.resolveTurn(request)

      // Assert
      expect(result).toEqual({
        answers: { ownsProperty: 'yes' },
        amendments: {},
        interaction: { kind: 'answer' },
      })
    })

    it('should reject an empty structured response', async () => {
      // Arrange
      const client: OpenAIResponsesClient = {
        responses: {
          create: vi.fn().mockResolvedValue({ output_text: '' }),
        },
      }
      const supplier = new OpenAISupplier({}, client)

      // Act
      const result = supplier.resolveTurn(request)

      // Assert
      await expect(result).rejects.toThrow('OpenAI returned no structured output')
    })
  })

  describe('clarifyTurn()', () => {
    it('should rewrite Forge validation using separate clarification guidance', async () => {
      // Arrange
      const create = vi.fn<OpenAIResponsesClient['responses']['create']>().mockResolvedValue({
        output_text: JSON.stringify({
          message: 'September has 30 days. What complete date did you intend?',
        }),
      })
      const supplier = new OpenAISupplier({ model: 'gpt-test', reasoningEffort: 'low' }, { responses: { create } })
      const turn = {
        content: [],
        questions: [
          {
            kind: 'date' as const,
            code: 'purchaseDate',
            prompt: 'When did you buy it?',
            llmHint: 'Return DD/MM/YYYY.',
            llmClarificationHint: 'Explain impossible calendar dates plainly.',
            errors: ['Tell me a real purchase date'],
          },
        ],
      }

      // Act
      const result = await supplier.clarifyTurn({ turn, messages: request.messages })

      // Assert
      expect(create).toHaveBeenCalledWith({
        model: 'gpt-test',
        reasoning: { effort: 'low' },
        instructions: expect.stringContaining("Follow each failed question's llmClarificationHint"),
        input: [
          {
            role: 'developer',
            content: expect.stringContaining('"llmClarificationHint":"Explain impossible calendar dates plainly."'),
          },
          ...request.messages,
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'forge_turn_clarification',
            description: 'A conversational explanation of Forge validation feedback.',
            schema: {
              type: 'object',
              properties: { message: { type: 'string' } },
              required: ['message'],
              additionalProperties: false,
            },
            strict: true,
          },
          verbosity: 'low',
        },
        store: false,
      })
      expect(result).toBe('September has 30 days. What complete date did you intend?')
    })
  })
})
