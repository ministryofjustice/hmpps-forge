import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import type {
  ForgeOutcome,
  ForgeRoute,
  RenderContext,
  RequestSnapshot,
} from '@ministryofjustice/hmpps-forge/core/framework'

import type { LlmProposedAnswers, LlmSupplier } from '../conversation/LlmConversation'
import type { LlmQuestionOutput, LlmTurnOutput } from '../functions/renderers/turn/llmTurn'
import { LlmAdapter } from './LlmAdapter'
import { LlmConversationAlreadyExistsError } from './LlmConversationAlreadyExistsError'
import { LlmConversationNotFoundError } from './LlmConversationNotFoundError'
import type { LlmSession, LlmSessionStore } from './LlmSessionStore'

const routes: ForgeRoute[] = [
  { nodeId: 'start', kind: 'step', templatePath: '/start', basePath: '', methods: ['GET', 'POST'] },
  { nodeId: 'next', kind: 'step', templatePath: '/next', basePath: '', methods: ['GET', 'POST'] },
  { nodeId: 'complete', kind: 'step', templatePath: '/complete', basePath: '', methods: ['GET', 'POST'] },
]

class TestLlmSessionStore implements LlmSessionStore {
  private readonly sessions = new Map<string, LlmSession>()

  async get(conversationId: string): Promise<LlmSession | undefined> {
    const session = this.sessions.get(conversationId)

    return session === undefined ? undefined : structuredClone(session)
  }

  async set(conversationId: string, session: LlmSession): Promise<void> {
    this.sessions.set(conversationId, structuredClone(session))
  }

  async delete(conversationId: string): Promise<void> {
    this.sessions.delete(conversationId)
  }
}

describe('LlmAdapter', () => {
  describe('start()', () => {
    it('should render and persist the opening conversational turn', async () => {
      // Arrange
      const store = new TestLlmSessionStore()
      const forge = createForge(snapshot => {
        expect(snapshot.location.pathname).toBe('/start')

        return renderOutcome(createTurn([createFreeTextQuestion('name', 'What is your name?')]))
      })
      const adapter = createAdapter(forge, createSupplier(), store)

      // Act
      const result = await adapter.start({ conversationId: 'conversation-1', entryPath: '/start' })

      // Assert
      expect(result).toMatchObject({ status: 'awaiting-input', message: 'What is your name?' })
      await expect(store.get('conversation-1')).resolves.toMatchObject({
        currentPath: '/start',
        messages: [{ role: 'assistant', content: 'What is your name?' }],
      })
    })

    it('should reject a conversation identifier that already exists', async () => {
      // Arrange
      const store = new TestLlmSessionStore()
      const adapter = createAdapter(
        createForge(() => renderOutcome(createTurn([createFreeTextQuestion('name', 'What is your name?')]))),
        createSupplier(),
        store,
      )

      await adapter.start({ conversationId: 'conversation-1', entryPath: '/start' })

      // Act
      const startAgain = adapter.start({ conversationId: 'conversation-1', entryPath: '/start' })

      // Assert
      await expect(startAgain).rejects.toBeInstanceOf(LlmConversationAlreadyExistsError)
    })
  })

  describe('respond()', () => {
    it('should reload a conversation and automatically advance through answerable steps', async () => {
      // Arrange
      const store = new TestLlmSessionStore()
      const execute = vi.fn((snapshot: RequestSnapshot): ForgeOutcome<unknown> => {
        if (snapshot.method === 'GET' && snapshot.location.pathname === '/start') {
          return renderOutcome(createTurn([createFreeTextQuestion('name', 'What is your name?')]))
        }

        if (snapshot.method === 'POST' && snapshot.location.pathname === '/start') {
          return { kind: 'navigate', url: '/next' }
        }

        if (snapshot.method === 'GET' && snapshot.location.pathname === '/next') {
          return renderOutcome(createTurn([createFreeTextQuestion('city', 'Where do you live?')]), {
            name: 'Sam',
          })
        }

        if (snapshot.method === 'POST' && snapshot.location.pathname === '/next') {
          return { kind: 'navigate', url: '/complete' }
        }

        return renderOutcome(createTurn([], 'Application complete'), { name: 'Sam', city: 'Leeds' })
      })
      const supplier = createSupplier(
        async (request: Parameters<LlmSupplier['resolveTurn']>[0]): Promise<LlmProposedAnswers> => {
          const code = request.turn.questions[0]?.code
          const answers: Readonly<Record<string, string>> = code === 'name' ? { name: 'Sam' } : { city: 'Leeds' }

          return { answers }
        },
      )
      const adapter = createAdapter(createForge(execute), supplier, store)

      await adapter.start({ conversationId: 'conversation-1', entryPath: '/start' })

      // Act
      const result = await adapter.respond({
        conversationId: 'conversation-1',
        message: 'I am Sam and I live in Leeds.',
      })

      // Assert
      expect(result).toMatchObject({ status: 'complete', message: 'Application complete' })
      expect(supplier.resolveTurn).toHaveBeenCalledTimes(2)
      expect(execute).toHaveBeenCalledTimes(5)
      await expect(store.get('conversation-1')).resolves.toMatchObject({
        currentPath: '/complete',
        recordedAnswers: { name: 'Sam', city: 'Leeds' },
      })
    })

    it('should stop before a question that requires an explicit answer', async () => {
      // Arrange
      const store = new TestLlmSessionStore()
      const supplier = createSupplier(async () => ({ answers: { name: 'Sam' } }))
      const forge = createForge(snapshot => {
        if (snapshot.method === 'GET' && snapshot.location.pathname === '/start') {
          return renderOutcome(createTurn([createFreeTextQuestion('name', 'What is your name?')]))
        }

        if (snapshot.method === 'POST') {
          return { kind: 'navigate', url: '/next' }
        }

        return renderOutcome(
          createTurn([
            {
              ...createFreeTextQuestion('confirmation', 'Is this correct?'),
              requiresExplicitAnswer: true,
            },
          ]),
        )
      })
      const adapter = createAdapter(forge, supplier, store)

      await adapter.start({ conversationId: 'conversation-1', entryPath: '/start' })

      // Act
      const result = await adapter.respond({ conversationId: 'conversation-1', message: 'Sam' })

      // Assert
      expect(result).toMatchObject({ status: 'awaiting-input', message: 'Is this correct?' })
      expect(supplier.resolveTurn).toHaveBeenCalledOnce()
    })

    it('should return supplier clarification without submitting Forge answers', async () => {
      // Arrange
      const store = new TestLlmSessionStore()
      const forge = createForge(() => renderOutcome(createTurn([createFreeTextQuestion('name', 'What is your name?')])))
      const supplier = createSupplier(async () => ({
        answers: {},
        interaction: { kind: 'clarification', message: 'I mean the name you normally use.' },
      }))
      const adapter = createAdapter(forge, supplier, store)

      await adapter.start({ conversationId: 'conversation-1', entryPath: '/start' })

      // Act
      const result = await adapter.respond({ conversationId: 'conversation-1', message: 'What do you mean?' })

      // Assert
      expect(result).toMatchObject({
        status: 'awaiting-input',
        message: 'I mean the name you normally use.',
      })
      expect(forge.execute).toHaveBeenCalledOnce()
    })

    it('should use supplier clarification for Forge validation feedback', async () => {
      // Arrange
      const store = new TestLlmSessionStore()
      const invalidTurn = createTurn([
        { ...createFreeTextQuestion('name', 'What is your name?'), errors: ['Enter your name'] },
      ])
      const forge = createForge(snapshot => {
        if (snapshot.method === 'GET') {
          return renderOutcome(createTurn([createFreeTextQuestion('name', 'What is your name?')]))
        }

        return renderOutcome(invalidTurn)
      })
      const supplier = createSupplier(
        async () => ({ answers: { name: ' ' } }),
        async () => 'Please enter a usable name.',
      )
      const adapter = createAdapter(forge, supplier, store)

      await adapter.start({ conversationId: 'conversation-1', entryPath: '/start' })

      // Act
      const result = await adapter.respond({ conversationId: 'conversation-1', message: 'My name is blank.' })

      // Assert
      expect(result).toMatchObject({ status: 'awaiting-input', message: 'Please enter a usable name.' })
      expect(supplier.clarifyTurn).toHaveBeenCalledOnce()
    })

    it('should surface navigation outside the registered Forge topology', async () => {
      // Arrange
      const store = new TestLlmSessionStore()
      const forge = createForge(snapshot => {
        if (snapshot.method === 'GET') {
          return renderOutcome(createTurn([createFreeTextQuestion('name', 'What is your name?')]))
        }

        return { kind: 'navigate', url: 'https://service.example/finished' }
      })
      const adapter = createAdapter(
        forge,
        createSupplier(async () => ({ answers: { name: 'Sam' } })),
        store,
      )

      await adapter.start({ conversationId: 'conversation-1', entryPath: '/start' })

      // Act
      const result = await adapter.respond({ conversationId: 'conversation-1', message: 'Sam' })

      // Assert
      expect(result).toEqual({ status: 'navigate', url: 'https://service.example/finished' })
    })

    it('should submit an explicit amendment to an earlier Forge step', async () => {
      // Arrange
      const store = new TestLlmSessionStore()
      let storedName = 'Sam'
      const execute = vi.fn((snapshot: RequestSnapshot): ForgeOutcome<unknown> => {
        if (snapshot.method === 'GET' && snapshot.location.pathname === '/start') {
          return renderOutcome(createTurn([createFreeTextQuestion('name', 'What is your name?')]))
        }

        if (snapshot.method === 'POST' && snapshot.location.pathname === '/start') {
          storedName = String(snapshot.post.name)

          return { kind: 'navigate', url: '/next' }
        }

        return renderOutcome(
          createTurn([
            {
              ...createFreeTextQuestion('city', 'Where do you live?'),
              requiresExplicitAnswer: true,
            },
          ]),
          { name: storedName },
        )
      })
      const supplier = createSupplier(
        async (request: Parameters<LlmSupplier['resolveTurn']>[0]): Promise<LlmProposedAnswers> => {
          if (request.turn.questions[0]?.code === 'name') {
            return { answers: { name: 'Sam' } }
          }

          return { answers: { city: 'Leeds' }, amendments: { name: 'Alex' } }
        },
      )
      const adapter = createAdapter(createForge(execute), supplier, store)

      await adapter.start({ conversationId: 'conversation-1', entryPath: '/start' })
      await adapter.respond({ conversationId: 'conversation-1', message: 'I am Sam.' })

      // Act
      const result = await adapter.respond({
        conversationId: 'conversation-1',
        message: 'Actually my name is Alex, and I live in Leeds.',
      })

      // Assert
      expect(result).toMatchObject({ status: 'awaiting-input' })
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          location: expect.objectContaining({ pathname: '/start' }),
          post: { name: 'Alex' },
        }),
      )
      await expect(store.get('conversation-1')).resolves.toMatchObject({ recordedAnswers: { name: 'Alex' } })
    })

    it('should reject a response for a conversation that does not exist', async () => {
      // Arrange
      const adapter = createAdapter(createForge(vi.fn()), createSupplier(), new TestLlmSessionStore())

      // Act
      const response = adapter.respond({ conversationId: 'missing', message: 'Hello' })

      // Assert
      await expect(response).rejects.toBeInstanceOf(LlmConversationNotFoundError)
    })

    it('should preserve the stored session when the supplier fails', async () => {
      // Arrange
      const store = new TestLlmSessionStore()
      const error = new Error('Supplier unavailable')
      const supplier = createSupplier(async () => {
        throw error
      })
      const adapter = createAdapter(
        createForge(() => renderOutcome(createTurn([createFreeTextQuestion('name', 'What is your name?')]))),
        supplier,
        store,
      )

      await adapter.start({ conversationId: 'conversation-1', entryPath: '/start' })
      const before = await store.get('conversation-1')

      // Act
      const response = adapter.respond({ conversationId: 'conversation-1', message: 'Sam' })

      // Assert
      await expect(response).rejects.toBe(error)
      await expect(store.get('conversation-1')).resolves.toEqual(before)
    })

    it('should preserve the stored session when Forge returns an error', async () => {
      // Arrange
      const store = new TestLlmSessionStore()
      const error = new Error('Forge submission failed')
      const forge = createForge(snapshot => {
        if (snapshot.method === 'GET') {
          return renderOutcome(createTurn([createFreeTextQuestion('name', 'What is your name?')]))
        }

        return { kind: 'error', error }
      })
      const adapter = createAdapter(
        forge,
        createSupplier(async () => ({ answers: { name: 'Sam' } })),
        store,
      )

      await adapter.start({ conversationId: 'conversation-1', entryPath: '/start' })
      const before = await store.get('conversation-1')

      // Act
      const response = adapter.respond({ conversationId: 'conversation-1', message: 'Sam' })

      // Assert
      await expect(response).rejects.toBe(error)
      await expect(store.get('conversation-1')).resolves.toEqual(before)
    })
  })

  describe('end()', () => {
    it('should delete the persisted conversation', async () => {
      // Arrange
      const store = new TestLlmSessionStore()
      const adapter = createAdapter(
        createForge(() => renderOutcome(createTurn([createFreeTextQuestion('name', 'What is your name?')]))),
        createSupplier(),
        store,
      )

      await adapter.start({ conversationId: 'conversation-1', entryPath: '/start' })

      // Act
      await adapter.end({ conversationId: 'conversation-1' })

      // Assert
      await expect(store.get('conversation-1')).resolves.toBeUndefined()
    })
  })
})

function createAdapter(forge: Forge, supplier: LlmSupplier, sessionStore: LlmSessionStore): LlmAdapter {
  return new LlmAdapter({ forge, supplier, sessionStore })
}

function createForge(
  execute: (snapshot: RequestSnapshot) => ForgeOutcome<unknown> | Promise<ForgeOutcome<unknown>>,
): Forge {
  return {
    getTopology: vi.fn(() => ({ routes })),
    execute: vi.fn(request => execute(request.snapshot)),
  } as unknown as Forge
}

function createSupplier(
  resolve: LlmSupplier['resolveTurn'] = async () => ({ answers: {} }),
  clarify: NonNullable<LlmSupplier['clarifyTurn']> = async () => 'Please try again.',
): LlmSupplier {
  return {
    resolveTurn: vi.fn(resolve),
    clarifyTurn: vi.fn(clarify),
  }
}

function createTurn(questions: readonly LlmQuestionOutput[], content?: string): LlmTurnOutput {
  return {
    content: content === undefined ? [] : [{ kind: 'content', content }],
    questions,
  }
}

function createFreeTextQuestion(code: string, prompt: string): LlmQuestionOutput {
  return {
    kind: 'free-text',
    code,
    prompt,
    errors: [],
  }
}

function renderOutcome(turn: LlmTurnOutput, answers: Record<string, unknown> = {}): ForgeOutcome<unknown> {
  return {
    kind: 'render',
    output: turn,
    context: createRenderContext(answers),
  }
}

function createRenderContext(answers: Record<string, unknown>): RenderContext {
  return {
    routeTree: [],
    step: { path: '/step' },
    ancestors: [],
    blocks: [],
    showValidationFailures: false,
    fieldValidationErrors: [],
    domainValidationErrors: [],
    answers,
    data: {},
  }
}
