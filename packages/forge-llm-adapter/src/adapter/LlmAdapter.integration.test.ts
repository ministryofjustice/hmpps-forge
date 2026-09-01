import { Forge } from '@ministryofjustice/hmpps-forge/core'

import type {
  LlmAnswerValue,
  LlmProposedAnswers,
  LlmResolveTurnRequest,
  LlmSupplier,
} from '../conversation/LlmConversation'
import type { LlmQuestionOutput } from '../functions/renderers/turn/llmTurn'
import { llmDemoPackage } from '../demo/llmDemoJourney'
import { LlmAdapter } from './LlmAdapter'
import type { LlmSession, LlmSessionStore } from './LlmSessionStore'

class SerialisingLlmSessionStore implements LlmSessionStore {
  private readonly sessions = new Map<string, string>()

  async get(conversationId: string): Promise<LlmSession | undefined> {
    const session = this.sessions.get(conversationId)

    return session === undefined ? undefined : (JSON.parse(session) as LlmSession)
  }

  async set(conversationId: string, session: LlmSession): Promise<void> {
    this.sessions.set(conversationId, JSON.stringify(session))
  }

  async delete(conversationId: string): Promise<void> {
    this.sessions.delete(conversationId)
  }
}

describe('LlmAdapter integration', () => {
  describe('conversation lifecycle', () => {
    it('should complete a real Forge journey across serialised adapter calls', async () => {
      // Arrange
      const supplier: LlmSupplier = {
        resolveTurn: vi.fn(async (request: LlmResolveTurnRequest) => ({
          answers: Object.fromEntries(
            request.turn.questions.map(question => [question.code, answerQuestion(question)]),
          ),
        })),
      }
      const forge = new Forge({
        logger: {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      }).registerPackage(llmDemoPackage)
      const adapter = new LlmAdapter({ forge, supplier, sessionStore: new SerialisingLlmSessionStore() })

      // Act
      const opening = await adapter.start({
        conversationId: 'conversation-1',
        entryPath: '/llm-demo/housing-situation',
      })
      const summary = await adapter.respond({
        conversationId: 'conversation-1',
        message: 'I live somewhere unusual and can tell you everything you need.',
      })
      const complete = await adapter.respond({ conversationId: 'conversation-1', message: 'Yes, that is correct.' })

      // Assert
      expect(opening.status).toBe('awaiting-input')
      expect(summary).toMatchObject({ status: 'awaiting-input' })
      expect(
        summary.status === 'awaiting-input' ? summary.turn.questions.map(question => question.code) : [],
      ).toContain('summaryCorrect')
      expect(complete).toMatchObject({
        status: 'complete',
        message: 'Thanks — that gives Forge a rounded picture of what home means to you.',
      })
      expect(supplier.resolveTurn).toHaveBeenCalled()
    })

    it('should expose journey-specific interpretation hints to the supplier', async () => {
      // Arrange
      const requests: LlmResolveTurnRequest[] = []
      const supplier: LlmSupplier = {
        resolveTurn: vi.fn(async (request: LlmResolveTurnRequest): Promise<LlmProposedAnswers> => {
          requests.push(request)

          return request.turn.questions.some(question => question.code === 'housingSituation')
            ? { answers: { housingSituation: 'renter' } }
            : { answers: {} }
        }),
      }
      const forge = new Forge({
        logger: {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      }).registerPackage(llmDemoPackage)
      const adapter = new LlmAdapter({ forge, supplier, sessionStore: new SerialisingLlmSessionStore() })

      await adapter.start({
        conversationId: 'conversation-1',
        entryPath: '/llm-demo/housing-situation',
      })

      // Act
      await adapter.respond({
        conversationId: 'conversation-1',
        message: 'I rent an apartment in the city centre.',
      })

      // Assert
      expect(requests[0]?.turn.questions[0]?.llmHint).toContain(
        'A property type, location, or description of the home does not distinguish owning, renting',
      )
      expect(requests[1]?.turn.questions.find(question => question.code === 'rentedPropertyType')?.llmHint).toBe(
        'The words flat or apartment in any earlier user message answer this question as flat, including when the user described the property before clarifying that they rent it. Return null when the user has not identified a property type.',
      )
    })
  })
})

function answerQuestion(question: LlmQuestionOutput): LlmAnswerValue {
  if (question.code === 'housingSituation') {
    return 'other'
  }

  if (question.code === 'summaryCorrect') {
    return 'yes'
  }

  if (question.kind === 'single-select') {
    return question.options[0]?.value ?? 'yes'
  }

  if (question.kind === 'multi-select') {
    return question.options[0] === undefined ? [] : [question.options[0].value]
  }

  if (question.kind === 'date') {
    return '2020-01-01'
  }

  return 'A detailed response supplied by the integration test.'
}
