import { describe, expect, it, vi } from 'vitest'
import WorkContext from '../../../work/WorkContext'
import WorkExecutor from '../../../work/WorkExecutor'
import type { CompiledHookLifecycleContext } from '../contracts/hookLifecycle.type'
import type { AccessHookNextResult } from '../contracts/AccessLifecycleWork.type'
import { createWorkTask } from '../../../work/workTask'
import { ACCESS_HOOK_WORK_HANDLER } from './AccessHookWorkHandler'
import { ACCESS_HOOK_WHEN_WORK_HANDLER } from './AccessHookWhenWorkHandler'
import { HOOK_EFFECT_WORK_HANDLER } from './HookEffectWorkHandler'

function createContext(): WorkContext<CompiledHookLifecycleContext> {
  return new WorkContext({
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    post: {},
    request: {},
    conditions: { get: vi.fn() } as unknown as CompiledHookLifecycleContext['conditions'],
    workTasks: {},
    effectFunctionContext: {},
  })
}

function createHook(
  key: string,
  options: {
    readonly when?: () => boolean | Promise<boolean>
    readonly effects?: readonly (() => void | Promise<void>)[]
    readonly next?: () => AccessHookNextResult | Promise<AccessHookNextResult>
  } = {},
) {
  return createWorkTask(key, ACCESS_HOOK_WORK_HANDLER, {
    when: createWorkTask(`${key}-when`, ACCESS_HOOK_WHEN_WORK_HANDLER, {
      evaluate: options.when ?? (() => true),
    }),
    effects: (options.effects ?? []).map((effect, index) =>
      createWorkTask(`${key}-effect-${index}`, HOOK_EFFECT_WORK_HANDLER, {
        name: `${key}-effect-${index}`,
        run: effect,
      }),
    ),
    next: options.next ?? (() => undefined),
  })
}

describe('AccessHookWorkHandler', () => {
  describe('execute()', () => {
    it('should default to executed continue when when, effects, and next are omitted', async () => {
      // Arrange
      const hook = createWorkTask('hook', ACCESS_HOOK_WORK_HANDLER, {})

      // Act
      const result = await new WorkExecutor().execute(hook, createContext())

      // Assert
      expect(result.output).toEqual({ executed: true, outcome: 'continue' })
    })

    it('should skip effects and next when the when predicate is false', async () => {
      // Arrange
      const effect = vi.fn()
      const next = vi.fn(() => undefined)
      const hook = createHook('hook', { when: () => false, effects: [effect], next })

      // Act
      const result = await new WorkExecutor().execute(hook, createContext())

      // Assert
      expect(effect).not.toHaveBeenCalled()
      expect(next).not.toHaveBeenCalled()
      expect(result.output).toEqual({ executed: false, outcome: 'continue' })
    })

    it('should run effects once then call next exactly once when the when predicate is true', async () => {
      // Arrange
      const calls: string[] = []
      const next = vi.fn(() => {
        calls.push('next')

        return undefined
      })
      const hook = createHook('hook', {
        effects: [
          () => {
            calls.push('first effect')
          },
          () => {
            calls.push('second effect')
          },
        ],
        next,
      })

      // Act
      const result = await new WorkExecutor().execute(hook, createContext())

      // Assert
      expect(calls).toEqual(['first effect', 'second effect', 'next'])
      expect(next).toHaveBeenCalledTimes(1)
      expect(result.output).toEqual({ executed: true, outcome: 'continue' })
    })

    it('should call next exactly once when there are no effects', async () => {
      // Arrange
      const next = vi.fn(() => undefined)
      const hook = createHook('hook', { next })

      // Act
      const result = await new WorkExecutor().execute(hook, createContext())

      // Assert
      expect(next).toHaveBeenCalledTimes(1)
      expect(result.output).toEqual({ executed: true, outcome: 'continue' })
    })

    it('should surface a redirect outcome from next after effects run', async () => {
      // Arrange
      const next = vi.fn(() => ({ type: 'redirect', value: '/login' }) as const)
      const hook = createHook('hook', { effects: [() => undefined], next })

      // Act
      const result = await new WorkExecutor().execute(hook, createContext())

      // Assert
      expect(next).toHaveBeenCalledTimes(1)
      expect(result.output).toEqual({ executed: true, outcome: 'redirect', redirect: '/login' })
    })

    it('should surface an error outcome from next after effects run', async () => {
      // Arrange
      const next = vi.fn(() => ({ type: 'error', value: { status: 403, message: 'No' } }) as const)
      const hook = createHook('hook', { effects: [() => undefined], next })

      // Act
      const result = await new WorkExecutor().execute(hook, createContext())

      // Assert
      expect(result.output).toEqual({ executed: true, outcome: 'error', status: 403, message: 'No' })
    })
  })
})
