import { createAccessLifecyclePhase } from './accessLifecyclePhase'
import TraceRecorder from '../trace/TraceRecorder'
import type { AccessLifecyclePlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledAccessHookResult } from '../../../contracts/compiled/compiledFunctions.type'
import { createPipelineState } from '../testing-helpers/pipelineStateFixtures'
import type FunctionRegistry from '../../../registries/FunctionRegistry'

const mockFunctionRegistry = {} as FunctionRegistry

function mockHook(result: CompiledAccessHookResult): AccessLifecyclePlan {
  return {
    accessHooks: [{ nodeId: 'compile_ast:1' as const, evaluate: vi.fn().mockReturnValue(result) }],
  }
}

describe('accessLifecyclePhase', () => {
  describe('execute()', () => {
    it('should return continue when access lifecycle passes', async () => {
      // Arrange
      const plan = mockHook({ executed: true, outcome: 'continue' })
      const phase = createAccessLifecyclePhase(plan, mockFunctionRegistry)

      // Act
      const state = createPipelineState()
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.navigationEvaluation).toBeUndefined()
      expect(state.validation).toBeUndefined()
      expect(state.showValidationFailures).toBeUndefined()
      expect(state.context.global.validation).toBeUndefined()
      expect(state.context.global.reachability).toBeUndefined()
    })

    it('should return halt-redirect when access lifecycle redirects', async () => {
      // Arrange
      const plan = mockHook({ executed: true, outcome: 'redirect', redirect: '/login' })
      const phase = createAccessLifecyclePhase(plan, mockFunctionRegistry)

      // Act
      const result = await phase.execute(createPipelineState())

      // Assert
      expect(result).toEqual({ action: 'halt-redirect', target: '/login', reason: 'access-lifecycle' })
    })

    it('should return halt-error when redirect target is missing', async () => {
      // Arrange
      const plan = mockHook({ executed: true, outcome: 'redirect', redirect: undefined })
      const phase = createAccessLifecyclePhase(plan, mockFunctionRegistry)

      // Act
      const result = await phase.execute(createPipelineState())

      // Assert
      expect(result).toEqual({ action: 'halt-error', status: 500, message: 'Hook redirect target is missing' })
    })

    it('should return halt-error when access lifecycle errors', async () => {
      // Arrange
      const plan = mockHook({ executed: true, outcome: 'error', status: 403, message: 'Forbidden' })
      const phase = createAccessLifecyclePhase(plan, mockFunctionRegistry)

      // Act
      const result = await phase.execute(createPipelineState())

      // Assert
      expect(result).toEqual({ action: 'halt-error', status: 403, message: 'Forbidden' })
    })

    it('should default error status to 500 when not provided', async () => {
      // Arrange
      const plan = mockHook({ executed: true, outcome: 'error' })
      const phase = createAccessLifecyclePhase(plan, mockFunctionRegistry)

      // Act
      const result = await phase.execute(createPipelineState())

      // Assert
      expect(result).toEqual({ action: 'halt-error', status: 500, message: 'Access denied' })
    })

    it('should record access-hook units into the state trace recorder when present', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const plan = mockHook({ executed: true, outcome: 'continue' })
      const phase = createAccessLifecyclePhase(plan, mockFunctionRegistry)

      recorder.beginPhase('access-lifecycle')

      // Act
      await phase.execute({ ...createPipelineState(), trace: recorder })
      recorder.endPhase('continue')

      // Assert
      const trace = recorder.finish('render')

      expect(trace.phases[0].units).toEqual([
        expect.objectContaining({ kind: 'access-hook', nodeId: 'compile_ast:1', outcome: 'continue' }),
      ])
    })

    it('should return continue when the plan has no hooks', async () => {
      // Arrange
      const phase = createAccessLifecyclePhase({ accessHooks: [] }, mockFunctionRegistry)

      // Act
      const result = await phase.execute(createPipelineState())

      // Assert
      expect(result).toEqual({ action: 'continue' })
    })
  })
})
