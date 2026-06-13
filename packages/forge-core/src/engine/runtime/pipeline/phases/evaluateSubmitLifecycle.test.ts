import { evaluateSubmitLifecycle } from './evaluateSubmitLifecycle'
import TraceRecorder from '../trace/TraceRecorder'
import type { SubmitLifecyclePlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledSubmitHookResult } from '../../../contracts/compiled/compiledFunctions.type'
import type { HookLifecycleContext } from '../../../contracts/compiled/phaseContexts.type'

const mockCtx = {} as HookLifecycleContext

const skippedResult: CompiledSubmitHookResult = { executed: false, validated: false, outcome: 'continue' }

const runTraced = async (plan: SubmitLifecyclePlan) => {
  const recorder = new TraceRecorder()

  recorder.beginPhase('submit-lifecycle')

  const result = await evaluateSubmitLifecycle(plan, mockCtx, recorder)

  recorder.endPhase('continue')

  return { result, units: recorder.finish('render').phases[0].units }
}

describe('evaluateSubmitLifecycle', () => {
  describe('short-circuiting', () => {
    it('should skip past unexecuted hooks and return the first executed result', async () => {
      // Arrange
      const skipped = vi.fn().mockResolvedValue(skippedResult)
      const executed = vi
        .fn()
        .mockResolvedValue({ executed: true, validated: true, outcome: 'redirect', redirect: '/next' })
      const never = vi.fn().mockResolvedValue(skippedResult)
      const plan: SubmitLifecyclePlan = {
        submitHooks: [
          { nodeId: 'compile_ast:1' as const, evaluate: skipped },
          { nodeId: 'compile_ast:2' as const, evaluate: executed },
          { nodeId: 'compile_ast:3' as const, evaluate: never },
        ],
      }

      // Act
      const result = await evaluateSubmitLifecycle(plan, mockCtx)

      // Assert
      expect(result).toEqual({ executed: true, validated: true, outcome: 'redirect', redirect: '/next' })
      expect(skipped).toHaveBeenCalledTimes(1)
      expect(never).not.toHaveBeenCalled()
    })

    it('should return a default skipped result when no hook executes', async () => {
      // Arrange
      const plan: SubmitLifecyclePlan = {
        submitHooks: [{ nodeId: 'compile_ast:1' as const, evaluate: vi.fn().mockResolvedValue(skippedResult) }],
      }

      // Act
      const result = await evaluateSubmitLifecycle(plan, mockCtx)

      // Assert
      expect(result).toEqual({ executed: false, validated: false, outcome: 'continue' })
    })
  })

  describe('tracing', () => {
    it('should record skipped hooks and the executed hook but nothing for hooks never run', async () => {
      // Arrange
      const plan: SubmitLifecyclePlan = {
        submitHooks: [
          { nodeId: 'compile_ast:1' as const, evaluate: vi.fn().mockResolvedValue(skippedResult) },
          {
            nodeId: 'compile_ast:2' as const,
            evaluate: vi
              .fn()
              .mockResolvedValue({ executed: true, validated: true, outcome: 'redirect', redirect: '/next' }),
          },
          { nodeId: 'compile_ast:3' as const, evaluate: vi.fn().mockResolvedValue(skippedResult) },
        ],
      }

      // Act
      const { units } = await runTraced(plan)

      // Assert
      expect(units).toEqual([
        expect.objectContaining({ kind: 'submit-hook', nodeId: 'compile_ast:1', executed: false }),
        expect.objectContaining({
          kind: 'submit-hook',
          nodeId: 'compile_ast:2',
          executed: true,
          validated: true,
          outcome: 'redirect',
          redirect: '/next',
        }),
      ])
    })

    it('should record status and message when an executed hook errors', async () => {
      // Arrange
      const plan: SubmitLifecyclePlan = {
        submitHooks: [
          {
            nodeId: 'compile_ast:1' as const,
            evaluate: vi
              .fn()
              .mockResolvedValue({ executed: true, validated: false, outcome: 'error', status: 400, message: 'Bad' }),
          },
        ],
      }

      // Act
      const { units } = await runTraced(plan)

      // Assert
      expect(units).toEqual([
        expect.objectContaining({
          kind: 'submit-hook',
          nodeId: 'compile_ast:1',
          executed: true,
          outcome: 'error',
          status: 400,
          message: 'Bad',
        }),
      ])
    })

    it('should record nothing and still evaluate hooks when no recorder is supplied', async () => {
      // Arrange
      const evaluate = vi.fn().mockResolvedValue(skippedResult)
      const plan: SubmitLifecyclePlan = {
        submitHooks: [{ nodeId: 'compile_ast:1' as const, evaluate }],
      }

      // Act
      await evaluateSubmitLifecycle(plan, mockCtx)

      // Assert
      expect(evaluate).toHaveBeenCalledTimes(1)
    })

    it('should invoke the hook snapshot callback only for the executed hook', async () => {
      // Arrange
      const recordHookSnapshot = vi.fn()
      const plan: SubmitLifecyclePlan = {
        submitHooks: [
          { nodeId: 'compile_ast:1' as const, evaluate: vi.fn().mockResolvedValue(skippedResult) },
          {
            nodeId: 'compile_ast:2' as const,
            evaluate: vi.fn().mockResolvedValue({ executed: true, validated: false, outcome: 'continue' }),
          },
        ],
      }

      // Act
      await evaluateSubmitLifecycle(plan, mockCtx, undefined, recordHookSnapshot)

      // Assert
      expect(recordHookSnapshot.mock.calls).toEqual([['compile_ast:2']])
    })
  })
})
