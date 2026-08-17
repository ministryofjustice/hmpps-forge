import { describe, expect, it, vi } from 'vitest'
import WorkContext from '../../../work/WorkContext'
import WorkExecutor from '../../../work/WorkExecutor'
import type { AccessHookNextResult } from '../contracts/AccessLifecycleWork.type'
import { createWorkTask } from '../../../work/workTask'
import { ACCESS_LIFECYCLE_WORK_HANDLER } from './AccessLifecycleWorkHandler'
import { ACCESS_HOOK_WHEN_WORK_HANDLER } from './AccessHookWhenWorkHandler'
import { ACCESS_HOOK_WORK_HANDLER } from './AccessHookWorkHandler'
import { HOOK_EFFECT_WORK_HANDLER } from './HookEffectWorkHandler'
import type { CompiledHookLifecycleContext } from '../contracts/hookLifecycle.type'

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

describe('AccessLifecycleWorkHandler', () => {
  describe('execute()', () => {
    it('should stop access hooks after the first halting outcome', async () => {
      // Arrange
      const calls: string[] = []
      const executor = new WorkExecutor()
      const lifecycle = createWorkTask('access-lifecycle', ACCESS_LIFECYCLE_WORK_HANDLER, {
        hooks: [
          createHook('first', {
            next: () => {
              calls.push('first')

              return { type: 'redirect', value: '/login' }
            },
          }),
          createHook('second', {
            next: () => {
              calls.push('second')

              return undefined
            },
          }),
        ],
      })

      // Act
      const result = await executor.execute(lifecycle, createContext())

      // Assert
      expect(calls).toEqual(['first'])
      expect(result.output).toEqual({ executed: true, outcome: 'redirect', redirect: '/login' })
      expect(result.children.map(child => child.key)).toEqual(['first'])
    })

    it('should skip effects and next when hook predicate is false', async () => {
      // Arrange
      const calls: string[] = []
      const executor = new WorkExecutor()
      const lifecycle = createWorkTask('access-lifecycle', ACCESS_LIFECYCLE_WORK_HANDLER, {
        hooks: [
          createHook('first', {
            when: () => false,
            effects: [
              () => {
                calls.push('effect')
              },
            ],
            next: () => {
              calls.push('next')

              return { type: 'redirect', value: '/login' }
            },
          }),
        ],
      })

      // Act
      const result = await executor.execute(lifecycle, createContext())

      // Assert
      expect(calls).toEqual([])
      expect(result.output).toEqual({ executed: true, outcome: 'continue' })
      expect(result.children[0].children.map(child => child.kind)).toEqual(['access.hook.when'])
    })

    it('should run effects sequentially before evaluating next', async () => {
      // Arrange
      const calls: string[] = []
      const executor = new WorkExecutor()
      const lifecycle = createWorkTask('access-lifecycle', ACCESS_LIFECYCLE_WORK_HANDLER, {
        hooks: [
          createHook('first', {
            effects: [
              () => {
                calls.push('first effect')
              },
              () => {
                calls.push('second effect')
              },
            ],
            next: () => {
              calls.push('next')

              return { type: 'error', value: { status: 403, message: 'No' } }
            },
          }),
        ],
      })

      // Act
      const result = await executor.execute(lifecycle, createContext())

      // Assert
      expect(calls).toEqual(['first effect', 'second effect', 'next'])
      expect(result.output).toEqual({ executed: true, outcome: 'error', status: 403, message: 'No' })
    })
  })
})
