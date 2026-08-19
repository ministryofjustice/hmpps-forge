import { describe, expect, it, vi } from 'vitest'
import WorkContext from '../../../chassis/work/WorkContext'
import WorkExecutor from '../../../chassis/work/WorkExecutor'
import type { CompiledHookLifecycleContext } from '../contracts/hookLifecycle.type'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { StepValidityResult } from '../../validation/contracts/stepValidityResult.type'
import type { WorkHandler } from '../../../chassis/contracts/work/work.type'
import { createWorkTask } from '../../../chassis/work/workTask'
import { HOOK_EFFECT_WORK_HANDLER } from './HookEffectWorkHandler'
import { SUBMIT_BRANCH_WORK_HANDLER } from './SubmitBranchWorkHandler'
import { SUBMIT_HOOK_PREDICATE_WORK_HANDLER } from './SubmitHookPredicateWorkHandler'
import { SUBMIT_HOOK_WORK_HANDLER } from './SubmitHookWorkHandler'
import { SUBMIT_LIFECYCLE_WORK_HANDLER } from './SubmitLifecycleWorkHandler'
import { CURRENT_STEP_VALIDATION_WORK_HANDLER } from '../../validation/runtime/CurrentStepValidationWorkHandler'
import type { SubmitHookNextResult } from '../contracts/SubmitLifecycleWork.type'

function createContext(overrides: Record<string, unknown> = {}): WorkContext<CompiledHookLifecycleContext> {
  const state = {
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    post: {},
    request: {},
    conditions: { get: vi.fn() } as unknown as CompiledHookLifecycleContext['conditions'],
    effectFunctionContext: {},
    accessLifecycleWorkHandler: {},
    accessHookWorkHandler: {},
    accessHookWhenWorkHandler: {},
    hookEffectWorkHandler: {},
    submitLifecycleWorkHandler: {},
    submitHookWorkHandler: {},
    submitHookPredicateWorkHandler: {},
    submitBranchWorkHandler: {},
    currentStepId: 'step-1',
    context: { evaluation: {}, domain: { data: {}, answers: {} }, request: {} },
    ...overrides,
  } as Record<string, unknown>

  state.dependencies = {
    currentStepId: state.currentStepId,
    buildStepValidation: state.buildStepValidation ?? (() => undefined),
  }
  state.recordCurrentPageValidation = (view: unknown) => {
    state.currentPageValidation = view
  }

  return new WorkContext(state as unknown as CompiledHookLifecycleContext)
}

function createHook(
  key: string,
  options: {
    readonly when?: () => boolean | Promise<boolean>
    readonly guards?: () => boolean | Promise<boolean>
    readonly onAlwaysEffects?: readonly (() => void | Promise<void>)[]
    readonly onAlwaysNext?: () => SubmitHookNextResult | Promise<SubmitHookNextResult>
    readonly validationGroups?: readonly string[]
    readonly onValidEffects?: readonly (() => void | Promise<void>)[]
    readonly onValidNext?: () => SubmitHookNextResult | Promise<SubmitHookNextResult>
    readonly onInvalidEffects?: readonly (() => void | Promise<void>)[]
    readonly onInvalidNext?: () => SubmitHookNextResult | Promise<SubmitHookNextResult>
  } = {},
) {
  return createWorkTask(key, SUBMIT_HOOK_WORK_HANDLER, {
    when: createWorkTask(`${key}-when`, SUBMIT_HOOK_PREDICATE_WORK_HANDLER, {
      name: 'when',
      evaluate: options.when ?? (() => true),
    }),
    guards: createWorkTask(`${key}-guards`, SUBMIT_HOOK_PREDICATE_WORK_HANDLER, {
      name: 'guards',
      evaluate: options.guards ?? (() => true),
    }),
    onAlways: createBranch(`${key}-onAlways`, 'onAlways', options.onAlwaysEffects, options.onAlwaysNext),
    validation:
      options.validationGroups === undefined
        ? undefined
        : createWorkTask(`${key}-validation`, CURRENT_STEP_VALIDATION_WORK_HANDLER, {
            groups: options.validationGroups,
            includeSubmissionOnly: true,
          }),
    onValid:
      options.onValidEffects === undefined && options.onValidNext === undefined
        ? undefined
        : createBranch(`${key}-onValid`, 'onValid', options.onValidEffects, options.onValidNext),
    onInvalid:
      options.onInvalidEffects === undefined && options.onInvalidNext === undefined
        ? undefined
        : createBranch(`${key}-onInvalid`, 'onInvalid', options.onInvalidEffects, options.onInvalidNext),
  })
}

function createBranch(
  key: string,
  name: 'onAlways' | 'onValid' | 'onInvalid',
  effects: readonly (() => void | Promise<void>)[] = [],
  next: () => SubmitHookNextResult | Promise<SubmitHookNextResult> = () => undefined,
) {
  return createWorkTask(key, SUBMIT_BRANCH_WORK_HANDLER, {
    name,
    effects: effects.map((effect, index) =>
      createWorkTask(`${key}-effect-${index}`, HOOK_EFFECT_WORK_HANDLER, {
        name: `${key}-effect-${index}`,
        run: effect,
      }),
    ),
    next,
  })
}

describe('SubmitLifecycleWorkHandler', () => {
  describe('execute()', () => {
    it('should stop submit hooks after the first executed hook', async () => {
      // Arrange
      const calls: string[] = []
      const executor = new WorkExecutor()
      const lifecycle = createWorkTask('submit-lifecycle', SUBMIT_LIFECYCLE_WORK_HANDLER, {
        hooks: [
          createHook('first', {
            onAlwaysNext: () => {
              calls.push('first')

              return { type: 'redirect', value: '/next' }
            },
          }),
          createHook('second', {
            onAlwaysNext: () => {
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
      expect(result.output).toEqual({
        executed: true,
        validated: false,
        outcome: 'redirect',
        redirect: '/next',
      })
      expect(result.children.map(child => child.key)).toEqual(['first'])
    })

    it('should not evaluate guards or branches when when predicate is false', async () => {
      // Arrange
      const calls: string[] = []
      const executor = new WorkExecutor()
      const lifecycle = createWorkTask('submit-lifecycle', SUBMIT_LIFECYCLE_WORK_HANDLER, {
        hooks: [
          createHook('first', {
            when: () => false,
            guards: () => {
              calls.push('guards')

              return true
            },
            onAlwaysEffects: [
              () => {
                calls.push('effect')
              },
            ],
          }),
        ],
      })

      // Act
      const result = await executor.execute(lifecycle, createContext())

      // Assert
      expect(calls).toEqual([])
      expect(result.output).toEqual({ executed: false, validated: false, outcome: 'continue' })
      expect(result.children[0].children.map(child => child.key)).toEqual(['first-when'])
    })

    it('should run onAlways before validation and then the selected valid branch', async () => {
      // Arrange
      const calls: string[] = []
      const result: StepValidityResult = { fieldFailures: [], domainFailures: [] }
      const buildStepValidation = vi.fn((_groups: string[]) => {
        const workType: WorkHandler<'validation.step', Record<string, never>> = {
          kind: 'validation.step',
          begin: () => {
            calls.push('validation')

            return { output: result }
          },
        }

        return createWorkTask('validation:stub', workType, {})
      })
      const executor = new WorkExecutor()
      const lifecycle = createWorkTask('submit-lifecycle', SUBMIT_LIFECYCLE_WORK_HANDLER, {
        hooks: [
          createHook('first', {
            onAlwaysEffects: [
              () => {
                calls.push('always effect')
              },
            ],
            validationGroups: ['lookup'],
            onValidEffects: [
              () => {
                calls.push('valid effect')
              },
            ],
            onValidNext: () => {
              calls.push('valid next')

              return { type: 'redirect', value: '/valid' }
            },
          }),
        ],
      })

      // Act
      const context = createContext({ buildStepValidation })
      const lifecycleResult = await executor.execute(lifecycle, context)

      // Assert
      expect(calls).toEqual(['always effect', 'validation', 'valid effect', 'valid next'])
      expect(buildStepValidation).toHaveBeenCalledWith('step-1', { groups: ['lookup'], includeSubmissionOnly: true })
      expect((context.state as unknown as RequestState).currentPageValidation).toEqual({
        isValid: true,
        fieldFailures: [],
        domainFailures: [],
      })
      expect(lifecycleResult.output).toEqual({
        executed: true,
        validated: true,
        isValid: true,
        outcome: 'redirect',
        redirect: '/valid',
      })
    })
  })
})
