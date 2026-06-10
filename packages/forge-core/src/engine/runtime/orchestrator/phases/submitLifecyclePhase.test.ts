import { createSubmitLifecyclePhase } from './submitLifecyclePhase'
import TraceRecorder from '../trace/TraceRecorder'
import type { SubmitLifecyclePlan, ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { PipelineState } from '../types'
import type { CompiledSubmitHookResult } from '../../../contracts/compiled/compiledFunctions.type'
import type { HookLifecycleContext } from '../../../contracts/compiled/phaseContexts.type'
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

const emptyValidationPlan: ValidationPlan = { fields: [], iteratorGroups: [] }

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
      const phase = createSubmitLifecyclePhase(
        plan,
        emptyValidationPlan,
        'compile_ast:1' as const,
        mockFunctionRegistry,
      )

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
      const phase = createSubmitLifecyclePhase(
        plan,
        emptyValidationPlan,
        'compile_ast:1' as const,
        mockFunctionRegistry,
      )

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'halt-redirect', target: '/next', reason: 'submit-lifecycle' })
    })

    it('should return halt-error when submit hooks error', async () => {
      // Arrange
      const plan = mockHook({ executed: true, validated: false, outcome: 'error', status: 400, message: 'Bad request' })
      const phase = createSubmitLifecyclePhase(
        plan,
        emptyValidationPlan,
        'compile_ast:1' as const,
        mockFunctionRegistry,
      )

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'halt-error', status: 400, message: 'Bad request' })
    })

    it('should throw when redirect target is missing', async () => {
      // Arrange
      const plan = mockHook({ executed: true, validated: false, outcome: 'redirect', redirect: undefined })
      const phase = createSubmitLifecyclePhase(
        plan,
        emptyValidationPlan,
        'compile_ast:1' as const,
        mockFunctionRegistry,
      )

      // Act & Assert
      await expect(phase.execute(createMockState())).rejects.toThrow('Hook redirect target is missing')
    })

    it('should record submit-hook units into the state trace recorder when present', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const plan = mockHook({ executed: true, validated: true, outcome: 'continue' })
      const phase = createSubmitLifecyclePhase(
        plan,
        emptyValidationPlan,
        'compile_ast:1' as const,
        mockFunctionRegistry,
      )

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

    it('should run validation on demand and stamp the verdict on the global context', async () => {
      // Arrange
      const failure = { blockId: 'compile_ast:2' as const, passed: false, message: 'Required', submissionOnly: false }
      const validationPlan: ValidationPlan = {
        fields: [{ nodeId: 'compile_ast:2' as const, validate: vi.fn().mockReturnValue([failure]) }],
        iteratorGroups: [],
      }
      const plan: SubmitLifecyclePlan = {
        hooks: [
          {
            nodeId: 'compile_ast:1' as const,
            evaluate: async (ctx: HookLifecycleContext) => {
              await ctx.validate?.(['default'])

              return { executed: true, validated: true, outcome: 'continue' }
            },
          },
        ],
      }
      const phase = createSubmitLifecyclePhase(plan, validationPlan, 'compile_ast:9' as const, mockFunctionRegistry)

      // Act
      const state = createMockState()
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.context.global.validation).toEqual(
        expect.objectContaining({
          stepId: 'compile_ast:9',
          validated: true,
          groups: ['default'],
          isSubmission: true,
          isValid: false,
        }),
      )
      expect(state.validation).toEqual(expect.objectContaining({ isValid: false, fieldFailures: [failure] }))
    })

    it('should pass validation trivially when a hook validates against an empty plan', async () => {
      // Arrange
      const plan: SubmitLifecyclePlan = {
        hooks: [
          {
            nodeId: 'compile_ast:1' as const,
            evaluate: async (ctx: HookLifecycleContext) => {
              await ctx.validate?.(['default'])

              return { executed: true, validated: true, outcome: 'continue' }
            },
          },
        ],
      }
      const phase = createSubmitLifecyclePhase(
        plan,
        emptyValidationPlan,
        'compile_ast:1' as const,
        mockFunctionRegistry,
      )

      // Act
      const state = createMockState()
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.validation).toEqual({ isValid: true, fieldFailures: [], domainFailures: [] })
    })

    it('should fall through to continue when the step has no submit hooks', async () => {
      // Arrange
      const phase = createSubmitLifecyclePhase(
        { hooks: [] },
        emptyValidationPlan,
        'compile_ast:1' as const,
        mockFunctionRegistry,
      )

      // Act
      const state = createMockState()
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.showValidationFailures).toBe(false)
      expect(state.validation).toBeUndefined()
    })
  })
})
