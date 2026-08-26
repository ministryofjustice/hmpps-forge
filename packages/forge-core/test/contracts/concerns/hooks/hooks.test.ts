import { describe, expect, it } from 'vitest'
import { expectErrorOutcome, type RequestTraceEvent } from '../../../../src/testing'
import ForgeRuntimeEvaluationError, {
  getForgeRuntimeEvaluationDiagnostics,
} from '../../../../src/engine/errors/ForgeRuntimeEvaluationError'
import { answerOf, answersFromTrace, createClient, createTracedClient } from '../../contractHelpers'
import { runJourneyCases } from '../../contractRunner'
import { cases } from './hooks.cases'
import {
  createUnusualNameEffectsClient,
  type HooksSession,
  submitEffectOrderJourney,
  accessShortCircuitJourney,
  journeyRootAccessRedirectJourney,
  submitBranchEffectsJourney,
  submitGuardsBlocksEffectsJourney,
  onAlwaysHaltsJourney,
  mutationSourceJourney,
  responseCookieJourney,
  cookieOptionsJourney,
  requestCaptureJourney,
  requestMetadataJourney,
  answerIntrospectionJourney,
  allDataJourney,
  fieldsToClearJourney,
  crashingEffectJourney,
  httpErrorEffectJourney,
  nonErrorEffectJourney,
  accidentalEffectError,
  httpEffectError,
  nonErrorEffectFailure,
} from './hooks.fixtures'

describe('hooks and effects contracts', () => {
  runJourneyCases(cases)

  describe('effect execution', () => {
    it('should execute submit effects in declaration order', async () => {
      // Arrange
      const session: HooksSession = {}
      const client = createClient(submitEffectOrderJourney)

      // Act
      await client.post('/submit-order/form', { session, body: { name: 'Ada' } })

      // Assert
      expect(session.effectLog).toEqual(['alpha', 'beta'])
    })

    it('should execute effects whose names are not JavaScript identifiers', async () => {
      // Arrange
      const client = createUnusualNameEffectsClient()

      // Act
      const result = await client.get('/unusual-effect-names/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.unusualEffectLog).toEqual(['class', 'audit.log', '123 effect'])
      }
    })
  })

  describe('access hook lifecycle', () => {
    it('should short-circuit remaining hooks on first non-continue outcome', async () => {
      // Arrange
      const session: HooksSession = {}
      const client = createClient(accessShortCircuitJourney)

      // Act
      const result = await client.get('/access-circuit/form', { session })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/access-circuit/blocked')
      }

      expect(session.effectLog).toEqual(['first'])
    })

    it('should fire journey onAccess redirect when GETting journey root path', async () => {
      // Arrange
      const session: HooksSession = {}
      const client = createClient(journeyRootAccessRedirectJourney)

      // Act
      const result = await client.get('/root-access-redirect', { session })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/root-access-redirect/intercepted')
      }

      expect(session.effectLog).toEqual(['root-hook'])
    })
  })

  describe('submit hook lifecycle', () => {
    it('should run onAlways effects before onValid effects when validation passes', async () => {
      // Arrange
      const session: HooksSession = {}
      const client = createClient(submitBranchEffectsJourney)

      // Act
      await client.post('/submit-branch/form', { session, body: { name: 'Ada' } })

      // Assert
      expect(session.effectLog).toEqual(['always', 'valid'])
    })

    it('should run effects when submit hook guards predicate evaluates true', async () => {
      // Arrange
      const session: HooksSession = { data: { guardOpen: true } }
      const client = createClient(submitGuardsBlocksEffectsJourney)

      // Act
      const result = await client.post('/submit-guards-effects/form', {
        session,
        body: { name: 'Ada' },
      })

      // Assert
      expect(result.type).toBe('redirect')
      expect(session.effectLog).toEqual(['guarded-effect'])
    })

    it('should redirect from onAlways before validation runs', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(onAlwaysHaltsJourney, traces)
      const session: HooksSession = { data: { skipValidation: true } }

      // Act
      const result = await client.post('/always-halts/form', {
        session,
        body: { name: '' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/always-halts/exit')
      }

      const submitHookUnits = traces[0].trace.phases
        .flatMap(phase => phase.units)
        .flatMap(unit => [unit, ...unit.children])
        .filter(unit => unit.kind === 'submit.hook')

      expect(submitHookUnits).toHaveLength(1)
      expect(submitHookUnits[0].completeFields.validated).toBe(false)
    })
  })

  describe('mutation history', () => {
    it('should record access source in answer mutation history', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(mutationSourceJourney, traces)

      // Act
      await client.post('/mutation-source/form', { session: {}, body: { name: 'Ada' } })

      // Assert
      const answers = answersFromTrace(traces[0])

      expect(answerOf(answers, 'accessField').mutations).toContainEqual({
        value: 'loaded',
        source: 'access',
      })
    })

    it('should record submit source in answer mutation history', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(mutationSourceJourney, traces)

      // Act
      await client.post('/mutation-source/form', { session: {}, body: { name: 'Ada' } })

      // Assert
      const answers = answersFromTrace(traces[0])

      expect(answerOf(answers, 'submitField').mutations).toContainEqual({
        value: 'processed',
        source: 'submit',
      })
    })
  })

  describe('response cookies', () => {
    it('should include setResponseCookie values in result cookies', async () => {
      // Arrange
      const client = createClient(responseCookieJourney)

      // Act
      const result = await client.get('/res-cookie/form', { session: {} })

      // Assert
      const cookie = result.cookies.get('preference')

      expect(cookie).toBeDefined()
      expect(cookie?.value).toBe('dark')
    })

    it('should pass cookie options through to result', async () => {
      // Arrange
      const client = createClient(cookieOptionsJourney)

      // Act
      const result = await client.get('/cookie-opts/form', { session: {} })

      // Assert
      const cookie = result.cookies.get('secure-pref')

      expect(cookie).toBeDefined()
      expect(cookie?.value).toBe('dark')
      expect(cookie?.options?.httpOnly).toBe(true)
      expect(cookie?.options?.secure).toBe(true)
      expect(cookie?.options?.maxAge).toBe(86400)
      expect(cookie?.options?.sameSite).toBe('strict')
    })
  })

  describe('context - request', () => {
    it('should expose POST body via getAllPostData', async () => {
      // Arrange
      const session: HooksSession = {}
      const client = createClient(requestCaptureJourney)

      // Act
      await client.post('/req-capture/form', { session, body: { name: 'Ada' } })

      // Assert
      expect(session.captured?.post).toEqual({ name: 'Ada' })
    })

    it('should expose query params via getAllQueryParams', async () => {
      // Arrange
      const client = createClient(requestCaptureJourney)

      // Act
      const result = await client.get('/req-capture/form', {
        session: {},
        query: { page: '2', filter: 'active' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.capturedQuery).toEqual({ page: '2', filter: 'active' })
      }
    })

    it('should expose full request URL via getRequestUrl', async () => {
      // Arrange
      const client = createClient(requestMetadataJourney)

      // Act
      const result = await client.get('/req-meta/123/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.requestUrl).toContain('/req-meta/123/form')
      }
    })

    it('should expose single query parameter via getQueryParam', async () => {
      // Arrange
      const client = createClient(requestMetadataJourney)

      // Act
      const result = await client.get('/req-meta/1/form', { session: {}, query: { page: '3' } })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.singleQuery).toBe('3')
      }
    })

    it('should expose single POST field via getPostData', async () => {
      // Arrange
      const session: HooksSession = {}
      const client = createClient(requestMetadataJourney)

      // Act
      await client.post('/req-meta/1/form', { session, body: { name: 'Ada' } })

      // Assert
      expect(session.captured?.singlePost).toBe('Ada')
    })

    it('should expose request state via getState and getAllState', async () => {
      // Arrange
      const client = createClient(requestMetadataJourney)

      // Act
      const result = await client.get('/req-meta/1/form', {
        session: {},
        state: { user: 'admin', role: 'editor' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.singleState).toBe('admin')
        expect(result.context.data.allState).toEqual({ user: 'admin', role: 'editor' })
      }
    })

    it('should expose request headers via getRequestHeader', async () => {
      // Arrange
      const session: HooksSession = {}
      const client = createClient(requestMetadataJourney)

      // Act
      await client.post('/req-meta/1/form', {
        session,
        body: { name: 'Ada' },
        headers: { 'X-Custom': 'header-value' },
      })

      // Assert
      expect(session.captured?.singleHeader).toBe('header-value')
    })

    it('should expose request cookies via getRequestCookie', async () => {
      // Arrange
      const session: HooksSession = {}
      const client = createClient(requestMetadataJourney)

      // Act
      await client.post('/req-meta/1/form', {
        session,
        body: { name: 'Ada' },
        cookies: { session: 'abc-123' },
      })

      // Assert
      expect(session.captured?.singleCookie).toBe('abc-123')
    })
  })

  describe('context - answer introspection', () => {
    it('should return full mutation history via getAnswerHistory', async () => {
      // Arrange
      const session: HooksSession = {
        answers: { 'answer-introspect': { existing: 'value' } },
      }
      const client = createClient(answerIntrospectionJourney)

      // Act
      const result = await client.get('/answer-introspect/form', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.hasAnswerHistory).toBe(true)

        const history = result.context.data.answerHistory as { current: unknown; mutations: unknown[] }

        expect(history.current).toBe('value')
        expect(history.mutations).toContainEqual({ value: 'value', source: 'access' })
      }
    })

    it('should return keys for all answers via getAllAnswerHistories', async () => {
      // Arrange
      const session: HooksSession = {
        answers: { 'answer-introspect': { existing: 'one', another: 'two' } },
      }
      const client = createClient(answerIntrospectionJourney)

      // Act
      const result = await client.get('/answer-introspect/form', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const keys = result.context.data.allHistoryKeys as string[]

        expect(keys).toContain('existing')
        expect(keys).toContain('another')
      }
    })
  })

  describe('context - data introspection', () => {
    it('should return all stored data via getAllData', async () => {
      // Arrange
      const session: HooksSession = {}
      const client = createClient(allDataJourney)

      // Act
      await client.get('/all-data/form', { session })

      // Assert
      const allData = session.captured?.allData as Record<string, unknown>

      expect(allData).toBeDefined()
      expect(allData.key1).toBe('value1')
      expect(allData.key2).toBe('value2')
    })
  })

  describe('context - cleardown', () => {
    it('should report stale fields to clear when step becomes unreachable', async () => {
      // Arrange
      const session: HooksSession = {
        answers: {
          'fields-clear': { choice: 'include', detail: 'some value' },
        },
      }
      const client = createClient(fieldsToClearJourney)

      // Act
      await client.post('/fields-clear/choose', { session, body: { choice: 'skip' } })

      // Assert
      const fieldsToClear = session.captured?.fieldsToClear as string[]

      expect(fieldsToClear).toContain('detail')
    })
  })

  describe('trace emission', () => {
    it('should emit a failed trace when the request pipeline fails', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(crashingEffectJourney, traces)

      // Act
      const result = await client.get('/crash-effect/form', { session: {} })

      // Assert
      expectErrorOutcome(result)
      expect(result.error).toBeInstanceOf(ForgeRuntimeEvaluationError)
      expect(result.error.cause).toBe(accidentalEffectError)
      expect(traces).toHaveLength(1)
      expect(traces[0].trace.outcome).toBe('error')
      expect(traces[0].trace.error).toEqual({
        message: result.error.message,
        stack: result.error.stack,
      })
    })
  })

  describe('error outcomes', () => {
    it('should preserve an HTTP Error thrown by an effect', async () => {
      // Arrange
      const client = createClient(httpErrorEffectJourney)

      // Act
      const result = await client.get('/http-error-effect/form', { session: {} })

      // Assert
      expectErrorOutcome(result)
      expect(result.error).toBeInstanceOf(ForgeRuntimeEvaluationError)
      expect(result.error.cause).toBe(httpEffectError)
      expect(result.error.status).toBe(404)
      expect(result.error.statusCode).toBe(404)
      expect(result.error.stack).toContain('Booking not found')
      expect(result.error.stack).toContain('Forge diagnostics:')
      expect(result.error.cause).toMatchObject({ dependency: 'bookingStore' })
      expect(getForgeRuntimeEvaluationDiagnostics(result.error)).toBeDefined()
      expect(result.error.stack).toContain('at [defined] ')
      expect(result.error.stack).toContain('hooks.fixtures.ts')
      expect(result.error.stack).toContain('FORGE_FULL_STACK=1 to expand')
      expect(result.error.stack).toContain('    Forge diagnostics:')
      expect(getForgeRuntimeEvaluationDiagnostics(result.error)?.definedAt).toContain('hooks.fixtures.ts')
    })

    it('should preserve an accidental Error thrown by an effect without assigning a status', async () => {
      // Arrange
      const client = createClient(crashingEffectJourney)

      // Act
      const result = await client.get('/crash-effect/form', { session: {} })

      // Assert
      expectErrorOutcome(result)
      expect(result.error).toBeInstanceOf(ForgeRuntimeEvaluationError)
      expect(result.error.cause).toBe(accidentalEffectError)
      expect(result.error.cause).toBeInstanceOf(SyntaxError)
      expect(result.error.status).toBeUndefined()
      expect(result.error.statusCode).toBeUndefined()
      expect(result.error.stack).toContain('Unexpected token in booking data')
      expect(result.error.stack).toContain('Forge diagnostics:')
      expect(getForgeRuntimeEvaluationDiagnostics(result.error)).toBeDefined()
    })

    it('should wrap a non-Error thrown by an effect and retain the value as its cause', async () => {
      // Arrange
      const client = createClient(nonErrorEffectJourney)

      // Act
      const result = await client.get('/non-error-effect/form', { session: {} })

      // Assert
      expectErrorOutcome(result)
      expect(result.error).toBeInstanceOf(ForgeRuntimeEvaluationError)
      expect(result.error.cause).toBe(nonErrorEffectFailure)
      expect(result.error.status).toBeUndefined()
      expect(result.error.statusCode).toBeUndefined()
      expect(result.error.stack).toContain('Forge diagnostics:')
      expect(result.error).toMatchObject({ phase: 'hooks' })
    })
  })
})
