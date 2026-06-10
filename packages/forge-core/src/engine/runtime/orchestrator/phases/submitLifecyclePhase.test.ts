import { createSubmitLifecyclePhase } from './submitLifecyclePhase'
import TraceRecorder from '../trace/TraceRecorder'
import type { SubmitLifecyclePlan, ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledSubmitHookResult } from '../../../contracts/compiled/compiledFunctions.type'
import type { HookLifecycleContext } from '../../../contracts/compiled/phaseContexts.type'
import { createPipelineState } from '../testing-helpers/pipelineStateFixtures'
import type FunctionRegistry from '../../../registries/FunctionRegistry'

const mockFunctionRegistry = {} as FunctionRegistry

const emptyValidationPlan: ValidationPlan = { fieldValidations: [], iteratorValidationGroups: [] }

function mockHook(result: CompiledSubmitHookResult): SubmitLifecyclePlan {
  return {
    submitHooks: [{ nodeId: 'compile_ast:1' as const, evaluate: vi.fn().mockReturnValue(result) }],
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
      const state = createPipelineState()
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
      const state = createPipelineState()
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'halt-redirect', target: '/next', reason: 'submit-lifecycle' })
      expect(state.navigationEvaluation).toBeUndefined()
      expect(state.validation).toBeUndefined()
      expect(state.showValidationFailures).toBeUndefined()
      expect(state.context.global.validation).toBeUndefined()
      expect(state.context.global.reachability).toBeUndefined()
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
      const result = await phase.execute(createPipelineState())

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
      await expect(phase.execute(createPipelineState())).rejects.toThrow('Hook redirect target is missing')
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
      await phase.execute({ ...createPipelineState(), trace: recorder })
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
        fieldValidations: [{ nodeId: 'compile_ast:2' as const, validate: vi.fn().mockReturnValue([failure]) }],
        iteratorValidationGroups: [],
      }
      const plan: SubmitLifecyclePlan = {
        submitHooks: [
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
      const state = createPipelineState()
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.context.global.validation).toEqual(
        expect.objectContaining({
          stepNodeId: 'compile_ast:9',
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
        submitHooks: [
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
      const state = createPipelineState()
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.validation).toEqual({ isValid: true, fieldFailures: [], domainFailures: [] })
    })

    it('should fall through to continue when the step has no submit hooks', async () => {
      // Arrange
      const phase = createSubmitLifecyclePhase(
        { submitHooks: [] },
        emptyValidationPlan,
        'compile_ast:1' as const,
        mockFunctionRegistry,
      )

      // Act
      const state = createPipelineState()
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.showValidationFailures).toBe(false)
      expect(state.validation).toBeUndefined()
    })
  })
})
