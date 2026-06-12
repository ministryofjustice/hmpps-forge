import { recordContextSnapshot } from './contextSnapshot'
import TraceRecorder from './TraceRecorder'
import RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import { createPipelineState } from '../testing-helpers/pipelineStateFixtures'
import type { ContextSnapshotTraceUnit } from '../../../contracts/trace/requestTrace.type'
import type { RuntimeEvaluationGlobalState } from '../../../contracts/runtime/evaluationState.type'
import type { ResponseBindings } from '../../../../framework/types/responseBindings.type'
import type { StepRequest } from '../../../../framework/types/request.type'
import type { PipelineState } from '../types'

function createTracedState(
  overrides: {
    global?: Partial<RuntimeEvaluationGlobalState>
    request?: Partial<StepRequest>
    responseBindings?: ResponseBindings
  } = {},
): { state: PipelineState; recorder: TraceRecorder } {
  const base = createPipelineState()
  const request = { ...base.request, ...overrides.request } as StepRequest
  const global: RuntimeEvaluationGlobalState = { data: {}, answers: {}, ...overrides.global }
  const recorder = new TraceRecorder()

  recorder.beginPhase('test-phase')

  return {
    state: {
      context: new RuntimeEvaluationContext(request, global),
      request,
      responseBindings: overrides.responseBindings ?? base.responseBindings,
      trace: recorder,
    },
    recorder,
  }
}

function finishToSnapshot(recorder: TraceRecorder): ContextSnapshotTraceUnit {
  const trace = recorder.finish('render')

  return trace.phases[0].units[0] as ContextSnapshotTraceUnit
}

describe('contextSnapshot', () => {
  describe('recordContextSnapshot()', () => {
    it('should record nothing when the state has no trace recorder', () => {
      // Arrange
      const state = createPipelineState()

      // Act & Assert
      expect(() => recordContextSnapshot(state, 'initial')).not.toThrow()
    })

    it('should record every context section under the point label when traced', () => {
      // Arrange
      const { state, recorder } = createTracedState({
        global: {
          data: { assessment: { id: 'a-1' } },
          answers: { visitType: { current: 'phone', mutations: [{ value: 'phone', source: 'post' }] } },
          fieldsToClear: ['oldField'],
        },
        request: {
          getParams: () => ({ personId: '42' }),
          getAllQuery: () => ({ page: '1' }),
          getAllPost: () => ({ visitType: 'phone' }),
          getSession: () => ({ user: 'jo' }),
          getAllState: () => ({ correlationId: 'abc' }),
        },
      })

      // Act
      recordContextSnapshot(state, 'answer-preparation')

      // Assert
      const unit = finishToSnapshot(recorder)

      expect(unit).toEqual(
        expect.objectContaining({
          kind: 'context-snapshot',
          point: 'answer-preparation',
          request: expect.objectContaining({
            params: { personId: '42' },
            query: { page: '1' },
            post: { visitType: 'phone' },
            session: { user: 'jo' },
            state: { correlationId: 'abc' },
          }),
          answers: { visitType: { current: 'phone', mutations: [{ value: 'phone', source: 'post' }] } },
          data: { assessment: { id: 'a-1' } },
          fieldsToClear: ['oldField'],
        }),
      )
    })

    it('should copy answers so later mutations do not change the snapshot', () => {
      // Arrange
      const answers = { visitType: { current: 'phone', mutations: [{ value: 'phone', source: 'post' as const }] } }
      const { state, recorder } = createTracedState({ global: { answers } })

      // Act
      recordContextSnapshot(state, 'initial')
      answers.visitType.current = 'in-person'
      answers.visitType.mutations.push({ value: 'in-person', source: 'post' })

      // Assert
      const unit = finishToSnapshot(recorder)

      expect(unit.answers).toEqual({
        visitType: { current: 'phone', mutations: [{ value: 'phone', source: 'post' }] },
      })
    })

    it('should capture response headers and cookies when the bindings hold mutations', () => {
      // Arrange
      const { state, recorder } = createTracedState({
        responseBindings: {
          setHeader: () => undefined,
          getHeader: () => undefined,
          getAllHeaders: () => new Map([['x-trace', 'on']]),
          setCookie: () => undefined,
          getCookie: () => undefined,
          getAllCookies: () => new Map([['preference', { value: 'dark', options: { httpOnly: true } }]]),
        },
      })

      // Act
      recordContextSnapshot(state, 'access-lifecycle')

      // Assert
      const unit = finishToSnapshot(recorder)

      expect(unit.response).toEqual({
        headers: { 'x-trace': 'on' },
        cookies: { preference: { value: 'dark', options: { httpOnly: true } } },
      })
    })

    it('should replace functions with name labels when values are not serializable', () => {
      // Arrange
      const namedFunction = function loadAssessment(): void {
        /* no-op */
      }
      const { state, recorder } = createTracedState({
        global: { data: { loader: namedFunction, anonymous: () => undefined } },
      })

      // Act
      recordContextSnapshot(state, 'initial')

      // Assert
      const unit = finishToSnapshot(recorder)

      expect(unit.data.loader).toBe('[Function: loadAssessment]')
      expect(unit.data.anonymous).toBe('[Function: anonymous]')
    })

    it('should replace circular references with a label when the value loops', () => {
      // Arrange
      const circular: Record<string, unknown> = { name: 'loop' }

      circular.self = circular

      const { state, recorder } = createTracedState({ global: { data: { circular } } })

      // Act
      recordContextSnapshot(state, 'initial')

      // Assert
      const unit = finishToSnapshot(recorder)

      expect(unit.data.circular).toEqual({ name: 'loop', self: '[Circular]' })
    })

    it('should replace values past the depth cap with a label when nesting is extreme', () => {
      // Arrange
      const deepest: Record<string, unknown> = { value: 'bottom' }
      const deep = Array.from({ length: 14 }).reduce<Record<string, unknown>>(nested => ({ nested }), deepest)
      const { state, recorder } = createTracedState({ global: { data: { deep } } })

      // Act
      recordContextSnapshot(state, 'initial')

      // Assert
      expect(JSON.stringify(finishToSnapshot(recorder).data)).toContain('"[MaxDepth]"')
    })

    it('should serialize Map, Set, Date and bigint values when they appear in the context', () => {
      // Arrange
      const { state, recorder } = createTracedState({
        global: {
          data: {
            lookup: new Map([['a', 1]]),
            tags: new Set(['x', 'y']),
            when: new Date('2026-06-12T00:00:00.000Z'),
            big: 42n,
          },
        },
      })

      // Act
      recordContextSnapshot(state, 'initial')

      // Assert
      const unit = finishToSnapshot(recorder)

      expect(unit.data).toEqual({
        lookup: { a: 1 },
        tags: ['x', 'y'],
        when: '2026-06-12T00:00:00.000Z',
        big: '42n',
      })
    })

    it('should serialize class instance properties when the session is not a plain object', () => {
      // Arrange
      class SessionLike {
        user = 'jo'
      }

      const session = new SessionLike()

      Object.defineProperty(session, 'broken', {
        enumerable: true,
        get: () => {
          throw new Error('not serializable')
        },
      })

      const { state, recorder } = createTracedState({ request: { getSession: () => session } })

      // Act
      recordContextSnapshot(state, 'initial')

      // Assert
      const unit = finishToSnapshot(recorder)

      expect(unit.request.session).toEqual({ user: 'jo', broken: '[Unserializable: SessionLike]' })
    })
  })
})
