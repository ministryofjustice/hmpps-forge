import { describe, expect, it } from 'vitest'
import type { RequestTraceEvent } from '../../src/testing'
import { answerOf, answersFromTrace } from './contractHelpers'
import {
  createHooksClient,
  createTracedHooksClient,
  type HooksSession,
  accessEffectOrderJourney,
  submitEffectOrderJourney,
  effectsBeforeOutcomesJourney,
  ancestorAccessOrderJourney,
  accessShortCircuitJourney,
  accessContinueJourney,
  submitBranchEffectsJourney,
  responseHeaderJourney,
  responseCookieJourney,
  requestCaptureJourney,
  directSetAnswerJourney,
  clearAnswerJourney,
  hasAnswerJourney,
  mutationSourceJourney,
  answerIntrospectionJourney,
  requestMetadataJourney,
  responseReadbackJourney,
  cookieOptionsJourney,
  allDataJourney,
  fieldsToClearJourney,
  accessFieldsToClearJourney,
  accessWhenFalseJourney,
  firstMatchWinsJourney,
  clearThenHasAnswerJourney,
  accessFieldsToClearReachableJourney,
  throwErrorBeforeValidationJourney,
} from './hooks.fixtures'

describe('hooks and effects contracts', () => {
  describe('effect execution', () => {
    it('should execute access effects in declaration order', async () => {
      // Arrange
      const client = createHooksClient(accessEffectOrderJourney)

      // Act
      const result = await client.get('/access-order/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.effectLog).toEqual(['first', 'second', 'third'])
      }
    })

    it('should execute submit effects in declaration order', async () => {
      // Arrange
      const session: HooksSession = {}
      const client = createHooksClient(submitEffectOrderJourney)

      // Act
      await client.post('/submit-order/form', { session, body: { name: 'Ada' } })

      // Assert
      expect(session.effectLog).toEqual(['alpha', 'beta'])
    })

    it('should complete access effects before evaluating outcomes', async () => {
      // Arrange
      const client = createHooksClient(effectsBeforeOutcomesJourney)

      // Act
      const result = await client.get('/effects-first/form', { session: {} })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/effects-first/redirected')
      }
    })
  })

  describe('access hook lifecycle', () => {
    it('should run ancestor journey hooks before child journey hooks', async () => {
      // Arrange
      const client = createHooksClient(ancestorAccessOrderJourney)

      // Act
      const result = await client.get('/parent-hooks/child/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.effectLog).toEqual(['parent', 'child'])
      }
    })

    it('should short-circuit remaining hooks on first non-continue outcome', async () => {
      // Arrange
      const session: HooksSession = {}
      const client = createHooksClient(accessShortCircuitJourney)

      // Act
      const result = await client.get('/access-circuit/form', { session })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/access-circuit/blocked')
      }

      expect(session.effectLog).toEqual(['first'])
    })

    it('should skip effects when access hook when-predicate evaluates false', async () => {
      // Arrange
      const client = createHooksClient(accessWhenFalseJourney)

      // Act
      const result = await client.get('/access-when-false/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.effectLog).toBeUndefined()
      }
    })

    it('should run all hook effects when no outcome halts', async () => {
      // Arrange
      const client = createHooksClient(accessContinueJourney)

      // Act
      const result = await client.get('/access-continue/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.effectLog).toEqual(['hook-one', 'hook-two'])
      }
    })

    it('should use first matching outcome when multiple outcomes match in one next array', async () => {
      // Arrange
      const client = createHooksClient(firstMatchWinsJourney)

      // Act
      const result = await client.get('/first-match-wins/form', { session: {} })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/first-match-wins/first-dest')
      }
    })
  })

  describe('submit hook lifecycle', () => {
    it('should run onAlways effects before onValid effects when validation passes', async () => {
      // Arrange
      const session: HooksSession = {}
      const client = createHooksClient(submitBranchEffectsJourney)

      // Act
      await client.post('/submit-branch/form', { session, body: { name: 'Ada' } })

      // Assert
      expect(session.effectLog).toEqual(['always', 'valid'])
    })

    // TODO: unskip when error routing through outcomes is reimplemented
    it.skip('should return error when onAlways throwError fires before validation runs', async () => {
      // Arrange
      const client = createHooksClient(throwErrorBeforeValidationJourney)

      // Act
      const result = await client.post('/throw-before-valid/form', {
        session: {},
        body: { name: '' },
      })

      // Assert
      expect(result.type).toBe('error')

      if (result.type === 'error') {
        expect(result.status).toBe(503)
        expect(result.message).toBe('Service unavailable')
      }
    })

    it('should run onAlways effects before onInvalid effects when validation fails', async () => {
      // Arrange
      const client = createHooksClient(submitBranchEffectsJourney)

      // Act
      const result = await client.post('/submit-branch/form', { session: {}, body: { name: '' } })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.effectLog).toEqual(['always', 'invalid'])
      }
    })
  })

  describe('context - answers', () => {
    it('should make setAnswer values available in render context', async () => {
      // Arrange
      const client = createHooksClient(directSetAnswerJourney)

      // Act
      const result = await client.get('/direct-answer/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(answerOf(result.context.answers, 'name').current).toBe('from-effect')
      }
    })

    it('should clear answers via clearAnswer', async () => {
      // Arrange
      const session: HooksSession = {
        answers: { 'clear-answer': { toRemove: 'old value', toKeep: 'keep this' } },
      }
      const client = createHooksClient(clearAnswerJourney)

      // Act
      const result = await client.get('/clear-answer/form', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(answerOf(result.context.answers, 'toKeep').current).toBe('keep this')
        expect(answerOf(result.context.answers, 'toRemove').current).toBeUndefined()
      }
    })

    it('should report hasAnswer correctly for existing and missing answers', async () => {
      // Arrange
      const session: HooksSession = {
        answers: { 'has-answer': { existing: 'some value' } },
      }
      const client = createHooksClient(hasAnswerJourney)

      // Act
      const result = await client.get('/has-answer/form', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.hasExisting).toBe(true)
        expect(result.context.data.hasMissing).toBe(false)
      }
    })

    it('should make hasAnswer return false after clearAnswer deletes the entry', async () => {
      // Arrange
      const client = createHooksClient(clearThenHasAnswerJourney)

      // Act
      const result = await client.get('/clear-has/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.hasBeforeClearing).toBe(true)
        expect(result.context.data.hasAfterClearing).toBe(false)
      }
    })

    // TODO: unskip when work descriptor tracing is implemented
    it.skip('should record access source in answer mutation history', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedHooksClient(mutationSourceJourney, traces)

      // Act
      await client.post('/mutation-source/form', { session: {}, body: { name: 'Ada' } })

      // Assert
      const answers = answersFromTrace(traces[0])

      expect(answerOf(answers, 'accessField').mutations).toContainEqual({
        value: 'loaded',
        source: 'access',
      })
    })

    // TODO: unskip when work descriptor tracing is implemented
    it.skip('should record submit source in answer mutation history', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedHooksClient(mutationSourceJourney, traces)

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

  describe('context - response', () => {
    it('should include setResponseHeader values in result headers', async () => {
      // Arrange
      const client = createHooksClient(responseHeaderJourney)

      // Act
      const result = await client.get('/res-header/form', { session: {} })

      // Assert
      expect(result.headers.get('X-Custom')).toBe('test-value')
      expect(result.headers.get('X-Request-Id')).toBe('abc-123')
    })

    it('should include setResponseCookie values in result cookies', async () => {
      // Arrange
      const client = createHooksClient(responseCookieJourney)

      // Act
      const result = await client.get('/res-cookie/form', { session: {} })

      // Assert
      const cookie = result.cookies.get('preference')

      expect(cookie).toBeDefined()
      expect(cookie?.value).toBe('dark')
    })
  })

  describe('context - request', () => {
    it('should expose POST body via getAllPostData', async () => {
      // Arrange
      const session: HooksSession = {}
      const client = createHooksClient(requestCaptureJourney)

      // Act
      await client.post('/req-capture/form', { session, body: { name: 'Ada' } })

      // Assert
      expect(session.captured?.post).toEqual({ name: 'Ada' })
    })

    it('should expose query params via getAllQueryParams', async () => {
      // Arrange
      const client = createHooksClient(requestCaptureJourney)

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

    it('should expose session via getSession', async () => {
      // Arrange
      const session: HooksSession = {
        answers: { 'req-capture': { name: 'Ada' } },
      }
      const client = createHooksClient(requestCaptureJourney)

      // Act
      const result = await client.get('/req-capture/form', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.sessionAnswerKeys).toEqual(['req-capture'])
      }
    })

    it('should expose single route parameter via getRequestParam', async () => {
      // Arrange
      const client = createHooksClient(requestMetadataJourney)

      // Act
      const result = await client.get('/req-meta/456/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.singleParam).toBe('456')
      }
    })

    it('should expose all route parameters via getAllRequestParams', async () => {
      // Arrange
      const client = createHooksClient(requestMetadataJourney)

      // Act
      const result = await client.get('/req-meta/789/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.allParams).toEqual({ id: '789' })
      }
    })

    it('should expose full request URL via getRequestUrl', async () => {
      // Arrange
      const client = createHooksClient(requestMetadataJourney)

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
      const client = createHooksClient(requestMetadataJourney)

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
      const client = createHooksClient(requestMetadataJourney)

      // Act
      await client.post('/req-meta/1/form', { session, body: { name: 'Ada' } })

      // Assert
      expect(session.captured?.singlePost).toBe('Ada')
    })

    it('should expose request state via getState and getAllState', async () => {
      // Arrange
      const client = createHooksClient(requestMetadataJourney)

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
      const client = createHooksClient(requestMetadataJourney)

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
      const client = createHooksClient(requestMetadataJourney)

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
    it('should return stored value via getAnswer', async () => {
      // Arrange
      const session: HooksSession = {
        answers: { 'answer-introspect': { existing: 'test-value', another: 'other' } },
      }
      const client = createHooksClient(answerIntrospectionJourney)

      // Act
      const result = await client.get('/answer-introspect/form', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.singleAnswer).toBe('test-value')
      }
    })

    it('should return all current values via getAllAnswers', async () => {
      // Arrange
      const session: HooksSession = {
        answers: { 'answer-introspect': { existing: 'one', another: 'two' } },
      }
      const client = createHooksClient(answerIntrospectionJourney)

      // Act
      const result = await client.get('/answer-introspect/form', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const allAnswers = result.context.data.allAnswers as Record<string, unknown>

        expect(allAnswers.existing).toBe('one')
        expect(allAnswers.another).toBe('two')
      }
    })

    it('should return full mutation history via getAnswerHistory', async () => {
      // Arrange
      const session: HooksSession = {
        answers: { 'answer-introspect': { existing: 'value' } },
      }
      const client = createHooksClient(answerIntrospectionJourney)

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
      const client = createHooksClient(answerIntrospectionJourney)

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
      const client = createHooksClient(allDataJourney)

      // Act
      await client.get('/all-data/form', { session })

      // Assert
      const allData = session.captured?.allData as Record<string, unknown>

      expect(allData).toBeDefined()
      expect(allData.key1).toBe('value1')
      expect(allData.key2).toBe('value2')
    })
  })

  describe('context - response readback', () => {
    it('should read back set headers via getResponseHeader', async () => {
      // Arrange
      const client = createHooksClient(responseReadbackJourney)

      // Act
      const result = await client.get('/res-readback/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.readbackHeader).toBe('header-value')
      }
    })

    it('should read back set cookies via getResponseCookie', async () => {
      // Arrange
      const client = createHooksClient(responseReadbackJourney)

      // Act
      const result = await client.get('/res-readback/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const cookie = result.context.data.readbackCookie as { value: string }

        expect(cookie.value).toBe('cookie-value')
      }
    })

    it('should track counts via getAllResponseHeaders and getAllResponseCookies', async () => {
      // Arrange
      const client = createHooksClient(responseReadbackJourney)

      // Act
      const result = await client.get('/res-readback/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.allHeaderCount).toBe(1)
        expect(result.context.data.allCookieCount).toBe(1)
      }
    })

    it('should pass cookie options through to result', async () => {
      // Arrange
      const client = createHooksClient(cookieOptionsJourney)

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

  describe('context - cleardown', () => {
    it('should report empty fields to clear in access hooks', async () => {
      // Arrange
      const client = createHooksClient(accessFieldsToClearJourney)

      // Act
      const result = await client.get('/access-ftc/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.fieldsToClear).toEqual([])
      }
    })

    it('should report empty fields to clear when answers exist but all fields are reachable', async () => {
      // Arrange
      const session: HooksSession = {
        answers: { 'access-ftc-reachable': { name: 'Ada' } },
      }
      const client = createHooksClient(accessFieldsToClearReachableJourney)

      // Act
      const result = await client.get('/access-ftc-reachable/form', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.fieldsToClear).toEqual([])
      }
    })

    it('should report stale fields to clear when step becomes unreachable', async () => {
      // Arrange
      const session: HooksSession = {
        answers: {
          'fields-clear': { choice: 'include', detail: 'some value' },
        },
      }
      const client = createHooksClient(fieldsToClearJourney)

      // Act
      await client.post('/fields-clear/choose', { session, body: { choice: 'skip' } })

      // Assert
      const fieldsToClear = session.captured?.fieldsToClear as string[]

      expect(fieldsToClear).toContain('detail')
    })
  })
})
