import { createSubmitLifecyclePhase } from './submitLifecyclePhase'
import TraceRecorder from '../trace/TraceRecorder'
import type { SubmitLifecyclePlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { PipelineState } from '../types'
import type { CompiledSubmitHookResult } from '../../../contracts/runtime/hookLifecycle.type'
import RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { StepRequest } from '../../../../framework/types/request.type'
import { NO_OP_RESPONSE_BINDINGS } from '../../../../framework/types/responseBindings.type'

const createMockState = (): PipelineState => {
  const request = {
    method: 'GET',
    url: 'http://localhost/forms/journey/step',
    baseUrl: '/forms/journey',
    location: {
      origin: 'http://localhost',
      href: 'http://localhost/forms/journey/step',
      pathname: '/forms/journey/step',
      basePath: '/forms/journey',
    },
    getHeader: () => undefined,
    getAllHeaders: () => ({}),
    getCookie: () => undefined,
    getAllCookies: () => ({}),
    getParam: () => undefined,
    getParams: () => ({}),
    getQuery: () => undefined,
    getAllQuery: () => ({}),
    getPost: () => undefined,
    getAllPost: () => ({}),
    getSession: () => undefined,
    getState: () => undefined,
    getAllState: () => ({}),
  } as unknown as StepRequest
  const context = new RuntimeEvaluationContext(request)

  return { context, request, responseBindings: NO_OP_RESPONSE_BINDINGS }
}

const mockFunctionRegistry = {} as FunctionRegistry

function mockHook(result: CompiledSubmitHookResult): SubmitLifecyclePlan {
  return {
    hooks: [{ nodeId: 'compile_ast:1' as const, evaluate: vi.fn().mockReturnValue(result) }],
  }
}

describe('submitLifecyclePhase', () => {
  describe('execute()', () => {
    it('should return continue and set showValidationFailures when hooks pass', async () => {
      // Arrange
      const plan = mockHook({ executed: true, validated: true, outcome: 'continue' })
      const phase = createSubmitLifecyclePhase(plan, undefined, 'compile_ast:1' as const, '/step', mockFunctionRegistry)

      // Act
      const state = createMockState()
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.showValidationFailures).toBe(true)
    })

    it('should return halt-redirect when submit hooks redirect', async () => {
      // Arrange
      const plan = mockHook({ executed: true, validated: false, outcome: 'redirect', redirect: '/next' })
      const phase = createSubmitLifecyclePhase(plan, undefined, 'compile_ast:1' as const, '/step', mockFunctionRegistry)

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'halt-redirect', target: '/next', reason: 'submit-lifecycle' })
    })

    it('should return halt-error when submit hooks error', async () => {
      // Arrange
      const plan = mockHook({ executed: true, validated: false, outcome: 'error', status: 400, message: 'Bad request' })
      const phase = createSubmitLifecyclePhase(plan, undefined, 'compile_ast:1' as const, '/step', mockFunctionRegistry)

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'halt-error', status: 400, message: 'Bad request' })
    })

    it('should throw when redirect target is missing', async () => {
      // Arrange
      const plan = mockHook({ executed: true, validated: false, outcome: 'redirect', redirect: undefined })
      const phase = createSubmitLifecyclePhase(plan, undefined, 'compile_ast:1' as const, '/step', mockFunctionRegistry)

      // Act & Assert
      await expect(phase.execute(createMockState())).rejects.toThrow('Hook redirect target is missing')
    })

    it('should record submit-hook units into the state trace recorder when present', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const plan = mockHook({ executed: true, validated: true, outcome: 'continue' })
      const phase = createSubmitLifecyclePhase(plan, undefined, 'compile_ast:1' as const, '/step', mockFunctionRegistry)

      recorder.beginPhase('submit-lifecycle')

      // Act
      await phase.execute({ ...createMockState(), trace: recorder })
      recorder.endPhase('continue')

      // Assert
      const trace = recorder.finish('render')

      expect(trace.phases[0].units).toEqual([
        expect.objectContaining({ kind: 'submit-hook', nodeId: 'compile_ast:1', executed: true, validated: true }),
      ])
    })

    it('should throw when plan is missing', async () => {
      // Arrange
      const phase = createSubmitLifecyclePhase(
        undefined,
        undefined,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
      )

      // Act & Assert
      await expect(phase.execute(createMockState())).rejects.toThrow(
        'Submit lifecycle plan is missing for step "/step"',
      )
    })
  })
})
