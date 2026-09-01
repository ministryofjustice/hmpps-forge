import type { LlmTurnOutput } from '../functions/renderers/turn/llmTurn'
import { LlmConversation, type LlmSupplier } from './LlmConversation'

const ownershipTurn: LlmTurnOutput = {
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
  ],
}

const propertyDetailsTurn: LlmTurnOutput = {
  content: [],
  questions: [
    {
      kind: 'free-text',
      code: 'propertyColour',
      prompt: 'What colour is the property?',
      errors: [],
    },
  ],
}

describe('LlmConversation', () => {
  it('should resolve a newly revealed question from the existing conversation', async () => {
    // Arrange
    const resolveTurn = vi.fn<LlmSupplier['resolveTurn']>()
      .mockResolvedValueOnce({ answers: { ownsProperty: 'yes' } })
      .mockResolvedValueOnce({ answers: { propertyColour: 'baby blue', futureAnswer: 'ignored' } })
    const conversation = new LlmConversation({ resolveTurn })
    conversation.addAssistantMessage('Do you own a property?')
    conversation.addUserMessage("Yes, and it's a beautiful baby blue colour.")

    // Act
    await conversation.resolveTurn(ownershipTurn)
    const resolution = await conversation.resolveTurn(propertyDetailsTurn)

    // Assert
    expect(resolveTurn).toHaveBeenLastCalledWith({
      turn: propertyDetailsTurn,
      priorAnswers: [],
      messages: [
        { role: 'assistant', content: 'Do you own a property?' },
        { role: 'user', content: "Yes, and it's a beautiful baby blue colour." },
      ],
    })
    expect(resolution).toEqual({
      answers: { propertyColour: 'baby blue' },
      amendments: [],
      unresolved: [],
      complete: true,
    })
  })

  it('should identify questions that the conversation does not answer', async () => {
    // Arrange
    const turn: LlmTurnOutput = {
      content: [],
      questions: [
        ...propertyDetailsTurn.questions,
        {
          kind: 'date',
          code: 'purchaseDate',
          prompt: 'When did you buy it?',
          errors: [],
        },
      ],
    }
    const client: LlmSupplier = {
      resolveTurn: vi.fn().mockResolvedValue({ answers: { propertyColour: 'baby blue' } }),
    }
    const conversation = new LlmConversation(client)

    // Act
    const resolution = await conversation.resolveTurn(turn)

    // Assert
    expect(resolution).toEqual({
      answers: { propertyColour: 'baby blue' },
      amendments: [],
      unresolved: ['purchaseDate'],
      complete: false,
    })
  })

  it('should reject proposed answers that do not match the rendered question contract', async () => {
    // Arrange
    const turn: LlmTurnOutput = {
      content: [],
      questions: [
        ...ownershipTurn.questions,
        ...propertyDetailsTurn.questions,
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
      ],
    }
    const client: LlmSupplier = {
      resolveTurn: vi.fn().mockResolvedValue({
        answers: {
          ownsProperty: 'maybe',
          propertyColour: '',
          propertyFeatures: ['garage', 'swimming-pool'],
          unknownQuestion: 'ignored',
        },
      }),
    }
    const conversation = new LlmConversation(client)

    // Act
    const resolution = await conversation.resolveTurn(turn)

    // Assert
    expect(resolution).toEqual({
      answers: {},
      amendments: [],
      unresolved: ['ownsProperty', 'propertyColour', 'propertyFeatures'],
      complete: false,
    })
  })

  it('should accept selection answers when every value is one of the rendered options', async () => {
    // Arrange
    const turn: LlmTurnOutput = {
      content: [],
      questions: [
        ...ownershipTurn.questions,
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
      ],
    }
    const client: LlmSupplier = {
      resolveTurn: vi.fn().mockResolvedValue({
        answers: { ownsProperty: 'yes', propertyFeatures: ['garden', 'garage'] },
      }),
    }
    const conversation = new LlmConversation(client)

    // Act
    const resolution = await conversation.resolveTurn(turn)

    // Assert
    expect(resolution).toEqual({
      answers: { ownsProperty: 'yes', propertyFeatures: ['garden', 'garage'] },
      amendments: [],
      unresolved: [],
      complete: true,
    })
  })

  it('should accept an explicit amendment to a previously answered question', async () => {
    // Arrange
    const client: LlmSupplier = {
      resolveTurn: vi.fn().mockResolvedValue({
        answers: { propertyColour: 'baby blue' },
        amendments: { ownsProperty: 'yes' },
      }),
    }
    const conversation = new LlmConversation(client)
    const priorAnswers = [
      {
        path: '/property/ownership',
        question: ownershipTurn.questions[0],
        answer: 'no',
      },
    ]

    // Act
    const resolution = await conversation.resolveTurn(propertyDetailsTurn, priorAnswers)

    // Assert
    expect(resolution).toEqual({
      answers: { propertyColour: 'baby blue' },
      amendments: [{ path: '/property/ownership', code: 'ownsProperty', answer: 'yes' }],
      unresolved: [],
      complete: true,
    })
  })

  it('should ignore unchanged or invalid amendments', async () => {
    // Arrange
    const turn: LlmTurnOutput = {
      content: [],
      questions: [],
    }
    const client: LlmSupplier = {
      resolveTurn: vi.fn().mockResolvedValue({
        answers: {},
        amendments: { ownsProperty: 'maybe', propertyColour: 'blue' },
      }),
    }
    const conversation = new LlmConversation(client)
    const priorAnswers = [
      { path: '/property/ownership', question: ownershipTurn.questions[0], answer: 'no' },
      { path: '/property/details', question: propertyDetailsTurn.questions[0], answer: 'blue' },
    ]

    // Act
    const resolution = await conversation.resolveTurn(turn, priorAnswers)

    // Assert
    expect(resolution).toEqual({ answers: {}, amendments: [], unresolved: [], complete: true })
  })
})
