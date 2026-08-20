import { describe, expect, it, vi } from 'vitest'
import WorkContext from '../../../chassis/work/WorkContext'
import WorkExecutor from '../../../chassis/work/WorkExecutor'
import type { CompiledHookLifecycleContext } from '../contracts/hookLifecycle.type'
import type { StepValidityResult } from '../../validation/contracts/stepValidityResult.type'
import type { NodeId } from '../../../chassis/contracts/ast/ast.type'
import type { WorkHandler } from '../../../chassis/contracts/work/work.type'
import { createWorkTask } from '../../../chassis/work/workTask'
import { SUBMIT_BRANCH_WORK_HANDLER } from './SubmitBranchWorkHandler'
import { SUBMIT_HOOK_PREDICATE_WORK_HANDLER } from './SubmitHookPredicateWorkHandler'
import { SUBMIT_HOOK_WORK_HANDLER } from './SubmitHookWorkHandler'
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
    readonly guards?: () => boolean | Promise<boolean>
    readonly onAlwaysNext?: () => SubmitHookNextResult | Promise<SubmitHookNextResult>
    readonly validationGroups?: readonly string[]
    readonly onValidNext?: () => SubmitHookNextResult | Promise<SubmitHookNextResult>
    readonly onInvalidNext?: () => SubmitHookNextResult | Promise<SubmitHookNextResult>
  } = {},
) {
  return createWorkTask(key, SUBMIT_HOOK_WORK_HANDLER, {
    when: createWorkTask(`${key}-when`, SUBMIT_HOOK_PREDICATE_WORK_HANDLER, {
      name: 'when',
      evaluate: () => true,
    }),
    guards: createWorkTask(`${key}-guards`, SUBMIT_HOOK_PREDICATE_WORK_HANDLER, {
      name: 'guards',
      evaluate: options.guards ?? (() => true),
    }),
    onAlways: createBranch(`${key}-onAlways`, 'onAlways', options.onAlwaysNext),
    validation:
      options.validationGroups === undefined
        ? undefined
        : createWorkTask(`${key}-validation`, CURRENT_STEP_VALIDATION_WORK_HANDLER, {
            groups: options.validationGroups,
            includeSubmissionOnly: true,
          }),
    onValid:
      options.onValidNext === undefined ? undefined : createBranch(`${key}-onValid`, 'onValid', options.onValidNext),
    onInvalid:
      options.onInvalidNext === undefined
        ? undefined
        : createBranch(`${key}-onInvalid`, 'onInvalid', options.onInvalidNext),
  })
}

function createBranch(
  key: string,
  name: 'onAlways' | 'onValid' | 'onInvalid',
  next: () => SubmitHookNextResult | Promise<SubmitHookNextResult> = () => undefined,
) {
  return createWorkTask(key, SUBMIT_BRANCH_WORK_HANDLER, {
    name,
    effects: [],
    next,
  })
}

function validResult(): StepValidityResult {
  return { fieldFailures: [], domainFailures: [] }
}

function invalidResult(groups: readonly string[]): StepValidityResult {
  return {
    fieldFailures: [
      {
        blockId: 'stub-field' as NodeId,
        blockCode: 'stub',
        passed: false,
        message: 'Invalid',
        submissionOnly: false,
        groups: [...groups],
      },
    ],
    domainFailures: [],
  }
}

function stubValidation(result: StepValidityResult) {
  const workType: WorkHandler<'validation.step', Record<string, never>> = {
    kind: 'validation.step',
    begin: () => ({ output: result }),
  }

  return createWorkTask('validation:stub', workType, {})
}

describe('SubmitHookWorkHandler', () => {
  describe('execute()', () => {
    it('should default to executed continue when when, guards, and onAlways are omitted', async () => {
      // Arrange
      const hook = createWorkTask('hook', SUBMIT_HOOK_WORK_HANDLER, {})

      // Act
      const result = await new WorkExecutor().execute(hook, createContext())

      // Assert
      expect(result.output).toEqual({ executed: true, validated: false, outcome: 'continue' })
    })

    it('should continue when the onAlways branch has no next or effects', async () => {
      // Arrange
      const hook = createWorkTask('hook', SUBMIT_HOOK_WORK_HANDLER, {
        onAlways: createWorkTask('hook-onAlways', SUBMIT_BRANCH_WORK_HANDLER, { name: 'onAlways' }),
      })

      // Act
      const result = await new WorkExecutor().execute(hook, createContext())

      // Assert
      expect(result.output).toEqual({ executed: true, validated: false, outcome: 'continue' })
    })

    it('should short-circuit to continue when guards are false', async () => {
      // Arrange
      const onAlwaysNext = vi.fn(() => undefined)
      const hook = createHook('hook', { guards: () => false, onAlwaysNext })

      // Act
      const result = await new WorkExecutor().execute(hook, createContext())

      // Assert
      expect(onAlwaysNext).not.toHaveBeenCalled()
      expect(result.output).toEqual({ executed: false, validated: false, outcome: 'continue' })
    })

    it('should short-circuit on an onAlways redirect before validation', async () => {
      // Arrange
      const buildStepValidation = vi.fn(() => stubValidation(validResult()))
      const hook = createHook('hook', {
        onAlwaysNext: () => ({ type: 'redirect', value: '/always' }) as const,
        validationGroups: ['lookup'],
      })

      // Act
      const result = await new WorkExecutor().execute(hook, createContext({ buildStepValidation }))

      // Assert
      expect(buildStepValidation).not.toHaveBeenCalled()
      expect(result.output).toEqual({ executed: true, validated: false, outcome: 'redirect', redirect: '/always' })
    })

    it('should select the onValid branch by key when validation passes', async () => {
      // Arrange
      const buildStepValidation = vi.fn(() => stubValidation(validResult()))
      const onValidNext = vi.fn(() => ({ type: 'redirect', value: '/valid' }) as const)
      const onInvalidNext = vi.fn(() => ({ type: 'redirect', value: '/invalid' }) as const)
      const hook = createHook('hook', { validationGroups: ['lookup'], onValidNext, onInvalidNext })

      // Act
      const result = await new WorkExecutor().execute(hook, createContext({ buildStepValidation }))

      // Assert
      expect(buildStepValidation).toHaveBeenCalledWith('step-1', { groups: ['lookup'], includeSubmissionOnly: true })
      expect(onValidNext).toHaveBeenCalledTimes(1)
      expect(onInvalidNext).not.toHaveBeenCalled()
      expect(result.output).toEqual({
        executed: true,
        validated: true,
        isValid: true,
        outcome: 'redirect',
        redirect: '/valid',
      })
    })

    it('should select the onInvalid branch by key when validation fails', async () => {
      // Arrange
      const buildStepValidation = vi.fn(() => stubValidation(invalidResult(['lookup'])))
      const onValidNext = vi.fn(() => ({ type: 'redirect', value: '/valid' }) as const)
      const onInvalidNext = vi.fn(() => ({ type: 'redirect', value: '/invalid' }) as const)
      const hook = createHook('hook', { validationGroups: ['lookup'], onValidNext, onInvalidNext })

      // Act
      const result = await new WorkExecutor().execute(hook, createContext({ buildStepValidation }))

      // Assert
      expect(onInvalidNext).toHaveBeenCalledTimes(1)
      expect(onValidNext).not.toHaveBeenCalled()
      expect(result.output).toEqual({
        executed: true,
        validated: true,
        isValid: false,
        outcome: 'redirect',
        redirect: '/invalid',
      })
    })
  })
})
