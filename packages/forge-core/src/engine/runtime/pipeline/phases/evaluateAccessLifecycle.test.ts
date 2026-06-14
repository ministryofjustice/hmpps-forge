import { evaluateAccessLifecycle } from './evaluateAccessLifecycle'
import TraceRecorder from '../trace/TraceRecorder'
import type { AccessLifecyclePlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledAccessHookResult } from '../../../contracts/compiled/compiledFunctions.type'
import type { HookLifecycleContext } from '../../../contracts/compiled/phaseContexts.type'

const passthroughRunEffect = async (_name: string, thunk: () => void | Promise<void>) => {
  await thunk()
}

const mockCtx = { runEffect: passthroughRunEffect } as unknown as HookLifecycleContext

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
        accessHooks: [
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
        accessHooks: [
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
        accessHooks: [
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
        accessHooks: [
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
        accessHooks: [
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
        accessHooks: [{ nodeId: 'compile_ast:1' as const, evaluate }],
      }

      // Act
      await evaluateAccessLifecycle(plan, mockCtx)

      // Assert
      expect(evaluate).toHaveBeenCalledTimes(1)
    })

    it('should invoke the hook snapshot callback after every hook run including the halting one', async () => {
      // Arrange
      const recordHookSnapshot = vi.fn()
      const plan: AccessLifecyclePlan = {
        accessHooks: [
          { nodeId: 'compile_ast:1' as const, evaluate: vi.fn().mockResolvedValue(continueResult) },
          {
            nodeId: 'compile_ast:2' as const,
            evaluate: vi.fn().mockResolvedValue({ executed: true, outcome: 'redirect', redirect: '/login' }),
          },
          { nodeId: 'compile_ast:3' as const, evaluate: vi.fn().mockResolvedValue(continueResult) },
        ],
      }

      // Act
      await evaluateAccessLifecycle(plan, mockCtx, undefined, recordHookSnapshot)

      // Assert
      expect(recordHookSnapshot.mock.calls).toEqual([['compile_ast:1'], ['compile_ast:2']])
    })

    it('should preserve async function trace units as children of the hook unit', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      recorder.beginPhase('access-lifecycle')
      const plan: AccessLifecyclePlan = {
        accessHooks: [
          {
            nodeId: 'compile_ast:1' as const,
            evaluate: vi.fn().mockImplementation(async (ctx: HookLifecycleContext) => {
              await ctx.runEffect('saveData', async () => {
                recorder.record({ kind: 'async-function', name: 'saveData', durationMs: 1 })
              })
              await ctx.runEffect('callApi', async () => {
                recorder.record({ kind: 'async-function', name: 'callApi', durationMs: 2 })
              })

              return continueResult
            }),
          },
        ],
      }

      // Act
      await evaluateAccessLifecycle(plan, mockCtx, recorder)
      recorder.endPhase('continue')
      const units = recorder.finish('render').phases[0].units

      // Assert
      expect(units).toHaveLength(1)
      const hookUnit = units[0] as { children?: readonly { kind: string; name?: string }[] }
      expect(hookUnit.children).toHaveLength(2)
      expect(hookUnit.children![0]).toEqual(expect.objectContaining({ kind: 'async-function', name: 'saveData' }))
      expect(hookUnit.children![1]).toEqual(expect.objectContaining({ kind: 'async-function', name: 'callApi' }))
    })

    it('should invoke the effect snapshot callback after each effect', async () => {
      // Arrange
      const recordEffectSnapshot = vi.fn()
      const recorder = new TraceRecorder()
      recorder.beginPhase('access-lifecycle')
      const plan: AccessLifecyclePlan = {
        accessHooks: [
          {
            nodeId: 'compile_ast:1' as const,
            evaluate: vi.fn().mockImplementation(async (ctx: HookLifecycleContext) => {
              await ctx.runEffect('saveData', async () => {})
              await ctx.runEffect('callApi', async () => {})

              return continueResult
            }),
          },
        ],
      }

      // Act
      await evaluateAccessLifecycle(plan, mockCtx, recorder, undefined, recordEffectSnapshot)

      // Assert
      expect(recordEffectSnapshot.mock.calls).toEqual([
        ['compile_ast:1', 'saveData'],
        ['compile_ast:1', 'callApi'],
      ])
    })
  })
})
