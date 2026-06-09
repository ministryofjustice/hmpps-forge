import { evaluateAccessLifecycle } from './evaluateAccessLifecycle'
import TraceRecorder from '../trace/TraceRecorder'
import type { AccessLifecyclePlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledAccessHookResult, HookLifecycleContext } from '../../../contracts/runtime/hookLifecycle.type'

const mockCtx = {} as HookLifecycleContext

const continueResult: CompiledAccessHookResult = { executed: true, outcome: 'continue' }

const runTraced = async (plan: AccessLifecyclePlan) => {
  const recorder = new TraceRecorder()

  recorder.beginPhase('access-lifecycle')

  const result = await evaluateAccessLifecycle(plan, mockCtx, recorder)

  recorder.endPhase('continue')

  return { result, units: recorder.finish('render').phases[0].units }
}

describe('evaluateAccessLifecycle', () => {
  describe('short-circuiting', () => {
    it('should run every hook in order and return continue when all hooks continue', async () => {
      // Arrange
      const order: string[] = []
      const first = vi.fn().mockImplementation(() => {
        order.push('first')

        return continueResult
      })
      const second = vi.fn().mockImplementation(() => {
        order.push('second')

        return continueResult
      })
      const plan: AccessLifecyclePlan = {
        hooks: [
          { nodeId: 'compile_ast:1' as const, evaluate: first },
          { nodeId: 'compile_ast:2' as const, evaluate: second },
        ],
      }

      // Act
      const result = await evaluateAccessLifecycle(plan, mockCtx)

      // Assert
      expect(order).toEqual(['first', 'second'])
      expect(result).toEqual({ executed: true, outcome: 'continue' })
    })

    it('should stop at the first redirect and not run later hooks', async () => {
      // Arrange
      const redirecting = vi
        .fn()
        .mockResolvedValue({ executed: true, outcome: 'redirect', redirect: '/login' })
      const never = vi.fn().mockResolvedValue(continueResult)
      const plan: AccessLifecyclePlan = {
        hooks: [
          { nodeId: 'compile_ast:1' as const, evaluate: redirecting },
          { nodeId: 'compile_ast:2' as const, evaluate: never },
        ],
      }

      // Act
      const result = await evaluateAccessLifecycle(plan, mockCtx)

      // Assert
      expect(result).toEqual({ executed: true, outcome: 'redirect', redirect: '/login' })
      expect(never).not.toHaveBeenCalled()
    })
  })

  describe('tracing', () => {
    it('should record one unit per hook run when tracing', async () => {
      // Arrange
      const plan: AccessLifecyclePlan = {
        hooks: [
          { nodeId: 'compile_ast:1' as const, evaluate: vi.fn().mockResolvedValue(continueResult) },
          { nodeId: 'compile_ast:2' as const, evaluate: vi.fn().mockResolvedValue(continueResult) },
        ],
      }

      // Act
      const { units } = await runTraced(plan)

      // Assert
      expect(units).toEqual([
        expect.objectContaining({ kind: 'access-hook', nodeId: 'compile_ast:1', outcome: 'continue' }),
        expect.objectContaining({ kind: 'access-hook', nodeId: 'compile_ast:2', outcome: 'continue' }),
      ])
    })

    it('should record the halting hook with its redirect target and nothing for hooks never run', async () => {
      // Arrange
      const plan: AccessLifecyclePlan = {
        hooks: [
          { nodeId: 'compile_ast:1' as const, evaluate: vi.fn().mockResolvedValue(continueResult) },
          {
            nodeId: 'compile_ast:2' as const,
            evaluate: vi.fn().mockResolvedValue({ executed: true, outcome: 'redirect', redirect: '/login' }),
          },
          { nodeId: 'compile_ast:3' as const, evaluate: vi.fn().mockResolvedValue(continueResult) },
        ],
      }

      // Act
      const { units } = await runTraced(plan)

      // Assert
      expect(units).toEqual([
        expect.objectContaining({ kind: 'access-hook', nodeId: 'compile_ast:1', outcome: 'continue' }),
        expect.objectContaining({
          kind: 'access-hook',
          nodeId: 'compile_ast:2',
          outcome: 'redirect',
          redirect: '/login',
        }),
      ])
    })

    it('should record status and message when a hook errors', async () => {
      // Arrange
      const plan: AccessLifecyclePlan = {
        hooks: [
          {
            nodeId: 'compile_ast:1' as const,
            evaluate: vi
              .fn()
              .mockResolvedValue({ executed: true, outcome: 'error', status: 403, message: 'Forbidden' }),
          },
        ],
      }

      // Act
      const { units } = await runTraced(plan)

      // Assert
      expect(units).toEqual([
        expect.objectContaining({
          kind: 'access-hook',
          nodeId: 'compile_ast:1',
          outcome: 'error',
          status: 403,
          message: 'Forbidden',
        }),
      ])
    })

    it('should record nothing and still evaluate hooks when no recorder is supplied', async () => {
      // Arrange
      const evaluate = vi.fn().mockResolvedValue(continueResult)
      const plan: AccessLifecyclePlan = {
        hooks: [{ nodeId: 'compile_ast:1' as const, evaluate }],
      }

      // Act
      await evaluateAccessLifecycle(plan, mockCtx)

      // Assert
      expect(evaluate).toHaveBeenCalledTimes(1)
    })
  })
})
