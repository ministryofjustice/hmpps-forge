import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import { FunctionType, HookType, PredicateType } from '../../../../authoring/types/enums'
import { formatGeneratorsRegistry } from '../../../../built-ins/functions/generators/formatGenerators'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import { AccessHookASTNode, SubmitHookASTNode } from '../../../chassis/contracts/ast/expressions.type'
import { TestPredicateASTNode } from '../../../chassis/contracts/ast/predicates.type'
import type { ResponseBindings } from '../../../../framework/types/responseBindings.type'
import { getForgeRuntimeEvaluationDiagnostics } from '../../../errors/ForgeRuntimeEvaluationError'
import type {
  CompiledAccessHookResult,
  CompiledAccessLifecycleFunction,
  CompiledSubmitHookResult,
  CompiledSubmitHooksFunction,
  CompiledHookLifecycleContext,
} from '../contracts/hookLifecycle.type'
import type { StepValidityResult } from '../../validation/contracts/stepValidityResult.type'
import type { NodeId } from '../../../chassis/contracts/ast/ast.type'
import HookAnalyzer from '../analysis/HookAnalyzer'
import type { AccessLifecycleModel, SubmitHooksModel } from '../contracts/hookModel.type'
import { createStepAnalysisContext } from '../../../chassis/compilation/analysis/testing-helpers/analysisContexts'
import HookLifecycleCompiler from './HookLifecycleCompiler'
import EffectFunctionContextImpl from '../../../chassis/runtime/context/EffectFunctionContext'
import WorkContext from '../../../chassis/work/WorkContext'
import WorkExecutor from '../../../chassis/work/WorkExecutor'
import { createWorkTask, isWorkTask } from '../../../chassis/work/workTask'
import type { WorkTask, WorkHandler } from '../../../chassis/contracts/work/work.type'
import type { SubmitLifecycleWorkTask } from '../contracts/SubmitLifecycleWork.type'
import { workTaskBuilders } from '../../../chassis/runtime/context/compiledEvaluationContext'

function accessModel(hooks: AccessHookASTNode[]): AccessLifecycleModel {
  const stepNode = ASTTestFactory.step().withProperty('onAccess', hooks).build()

  return new HookAnalyzer().analyzeStep(createStepAnalysisContext({ stepNode })).access
}

function submitModel(hooks: SubmitHookASTNode[]): SubmitHooksModel {
  const stepNode = ASTTestFactory.step().withProperty('onSubmission', hooks).build()

  return new HookAnalyzer().analyzeStep(createStepAnalysisContext({ stepNode })).submit
}

function createPredicate(answerCode: string, functionName = 'isRequired'): TestPredicateASTNode {
  return ASTTestFactory.predicate(PredicateType.TEST, {
    subject: ASTTestFactory.reference(['answers', answerCode]),
    condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, functionName),
  }) as TestPredicateASTNode
}

function stubValidation(result: StepValidityResult) {
  const workType: WorkHandler<'validation.step', Record<string, never>> = {
    kind: 'validation.step',
    begin: () => ({ output: result }),
  }

  return createWorkTask('validation:stub', workType, {})
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

type HookContextOverrides = Partial<CompiledHookLifecycleContext> & {
  readonly validation?: StepValidityResult
  readonly buildStepValidation?: (...args: unknown[]) => unknown
  readonly recordStepValidation?: (...args: unknown[]) => void
}

function createContext(
  functionRegistry: FunctionRegistry,
  overrides: HookContextOverrides = {},
): CompiledHookLifecycleContext {
  const answers = overrides.answers ?? {}
  const data = overrides.data ?? {}
  const response = {
    setHeader: vi.fn(),
    setCookie: vi.fn(),
  } as unknown as ResponseBindings
  const stepValidities = new Map<string, StepValidityResult>()

  const state = {
    answers,
    data,
    session: {},
    params: {},
    query: {},
    post: {},
    request: { url: 'http://localhost/forms/journey/step', path: '/forms/journey/step', method: 'POST' },
    conditions: functionRegistry,
    buildStepValidation: vi.fn(() =>
      stubValidation({
        fieldFailures: overrides.validation?.fieldFailures ?? [],
        domainFailures: overrides.validation?.domainFailures ?? [],
      }),
    ),
    recordStepValidation: vi.fn((stepId: string, result: StepValidityResult) => stepValidities.set(stepId, result)),
    effectFunctionContext: new EffectFunctionContextImpl(
      { domain: { answers, data }, evaluation: {}, request: {} } as any,
      response,
      'access',
    ),
    workTasks: workTaskBuilders,
    currentStepId: 'submit-step',
    context: { evaluation: { stepValidities }, domain: { data: {}, answers: {} }, request: {} },
    ...overrides,
  } as Record<string, unknown>

  state.dependencies = {
    currentStepId: state.currentStepId,
    buildStepValidation: state.buildStepValidation ?? (() => undefined),
  }
  state.recordCurrentPageValidation = (view: unknown) => {
    state.currentPageValidation = view
  }

  return state as unknown as CompiledHookLifecycleContext
}

async function executeCompiledAccessLifecycle(
  fn: CompiledAccessLifecycleFunction,
  ctx: CompiledHookLifecycleContext,
): Promise<CompiledAccessHookResult> {
  const task = await fn(ctx)

  if (!isCompiledAccessLifecycleWorkTask(task)) {
    throw new Error('Expected compiled access lifecycle to return a work task')
  }

  return (await new WorkExecutor().execute(task, new WorkContext(ctx))).output
}

function isCompiledAccessLifecycleWorkTask(value: unknown): value is WorkTask<'access.lifecycle', unknown> {
  return isWorkTask(value)
}

async function executeCompiledSubmitHooks(
  fn: CompiledSubmitHooksFunction,
  ctx: CompiledHookLifecycleContext,
): Promise<CompiledSubmitHookResult> {
  const task = await fn(ctx)

  if (!isCompiledSubmitHooksWorkTask(task)) {
    throw new Error('Expected compiled submit hooks to return a work task')
  }

  return (await new WorkExecutor().execute(task, new WorkContext(ctx))).output
}

function isCompiledSubmitHooksWorkTask(value: unknown): value is WorkTask<'submit.lifecycle', unknown> {
  return isWorkTask(value)
}

describe('HookLifecycleCompiler', () => {
  let compiler: HookLifecycleCompiler
  let functionRegistry: FunctionRegistry

  beforeEach(() => {
    ASTTestFactory.resetIds()
    functionRegistry = new FunctionRegistry()
    compiler = new HookLifecycleCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })
    functionRegistry.register({
      ...formatGeneratorsRegistry.build(),
      isRequired: {
        name: 'isRequired',
        isAsync: false,
        evaluate: (value: unknown) =>
          value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== ''),
      },
      loadProfile: {
        name: 'loadProfile',
        isAsync: true,
        evaluate: async (ctx: { setAnswer: (key: string, value: string) => void }) => {
          ctx.setAnswer('profileLoaded', 'yes')
        },
      },
      markAction: {
        name: 'markAction',
        isAsync: false,
        evaluate: (ctx: { setData: (key: string, value: string) => void }) => {
          ctx.setData('action', 'ran')
        },
      },
      submitEffect: {
        name: 'submitEffect',
        isAsync: false,
        evaluate: (ctx: { setData: (key: string, value: string) => void }) => {
          ctx.setData('submit', 'ran')
        },
      },
      throwingEffect: {
        name: 'throwingEffect',
        isAsync: false,
        evaluate: () => {
          throw new Error('Effect failed')
        },
      },
    })
  })

  describe('access lifecycle', () => {
    it('should return continue when no access hooks are configured', async () => {
      // Arrange
      const fn = compiler.compileAccessLifecycle(accessModel([]))
      const ctx = createContext(functionRegistry)

      // Act
      const result = await executeCompiledAccessLifecycle(fn, ctx)

      // Assert
      expect(result).toEqual({ executed: true, outcome: 'continue' })
    })

    it('should execute access effects and return continue when no outcome matches', async () => {
      // Arrange
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'loadProfile')
      const hook = ASTTestFactory.hook(HookType.ACCESS)
        .withProperty('when', createPredicate('allowed'))
        .withProperty('effects', [effect])
        .build() as AccessHookASTNode
      const fn = compiler.compileAccessLifecycle(accessModel([hook]))
      const ctx = createContext(functionRegistry, {
        answers: { allowed: { current: 'yes', mutations: [] } },
      })

      // Act
      const result = await executeCompiledAccessLifecycle(fn!, ctx)

      // Assert
      expect(result).toEqual({ executed: true, outcome: 'continue' })
      expect(ctx.answers.profileLoaded.current).toBe('yes')
      expect(ctx.answers.profileLoaded.mutations[0].source).toBe('access')
    })

    it('should run outer access hooks before step hooks and halt on redirect', async () => {
      // Arrange
      const outerEffect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'markAction')
      const outerHook = ASTTestFactory.hook(HookType.ACCESS)
        .withProperty('effects', [outerEffect])
        .build() as AccessHookASTNode
      const redirect = ASTTestFactory.redirectOutcome({ goto: '/login' })
      const stepHook = ASTTestFactory.hook(HookType.ACCESS)
        .withProperty('next', [redirect])
        .build() as AccessHookASTNode
      const fn = compiler.compileAccessLifecycle(accessModel([outerHook, stepHook]))
      const ctx = createContext(functionRegistry)

      // Act
      const result = await executeCompiledAccessLifecycle(fn!, ctx)

      // Assert
      expect(ctx.data.action).toBe('ran')
      expect(result).toEqual({ executed: true, outcome: 'redirect', redirect: '/login' })
    })

    it('should compile access effects before a redirect using loaded data', async () => {
      // Arrange
      const syncEffect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'markAction')
      const asyncEffect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'loadProfile')
      const redirect = ASTTestFactory.redirectOutcome({ goto: ASTTestFactory.reference(['data', 'redirectPath']) })
      const hook = ASTTestFactory.hook(HookType.ACCESS)
        .withProperty('effects', [syncEffect, asyncEffect])
        .withProperty('next', [redirect])
        .build() as AccessHookASTNode
      const fn = compiler.compileAccessLifecycle(accessModel([hook]))
      const ctx = createContext(functionRegistry, {
        data: { redirectPath: '/sentence-plan' },
      })

      // Act
      const result = await executeCompiledAccessLifecycle(fn!, ctx)

      // Assert
      expect(ctx.data.action).toBe('ran')
      expect(ctx.answers.profileLoaded.current).toBe('yes')
      expect(result).toEqual({ executed: true, outcome: 'redirect', redirect: '/sentence-plan' })
    })

    it('should compile formatted redirects after async access effects', async () => {
      // Arrange
      const asyncEffect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'loadProfile')
      const loadHook = ASTTestFactory.hook(HookType.ACCESS)
        .withProperty('effects', [asyncEffect])
        .build() as AccessHookASTNode
      const formattedGoto = ASTTestFactory.formatExpression('/profile/%1', [
        ASTTestFactory.reference(['data', 'profileId']),
      ])
      const redirectHook = ASTTestFactory.hook(HookType.ACCESS)
        .withProperty('next', [ASTTestFactory.redirectOutcome({ goto: formattedGoto })])
        .build() as AccessHookASTNode
      const fn = compiler.compileAccessLifecycle(accessModel([loadHook, redirectHook]))
      const ctx = createContext(functionRegistry, {
        data: { profileId: 'ABC123' },
      })

      // Act
      const result = await executeCompiledAccessLifecycle(fn!, ctx)

      // Assert
      expect(ctx.answers.profileLoaded.current).toBe('yes')
      expect(result).toEqual({ executed: true, outcome: 'redirect', redirect: '/profile/ABC123' })
    })

    it('should throw runtime errors when access effects fail', async () => {
      // Arrange
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'throwingEffect')
      const hook = ASTTestFactory.hook(HookType.ACCESS)
        .withProperty('effects', [effect])
        .build() as AccessHookASTNode
      const fn = compiler.compileAccessLifecycle(accessModel([hook]))
      const ctx = createContext(functionRegistry)

      // Act
      let thrown: unknown

      try {
        await executeCompiledAccessLifecycle(fn!, ctx)
      } catch (error) {
        thrown = error
      }

      // Assert
      if (!(thrown instanceof Error)) {
        throw new Error('Expected throwingEffect to throw the original Error')
      }

      expect(thrown.message).toBe('Failed to evaluate compiled Forge hooks function: Effect failed')
      expect(getForgeRuntimeEvaluationDiagnostics(thrown)).toMatchObject({
        phase: 'hooks',
        functionName: 'throwingEffect',
        functionType: FunctionType.EFFECT,
      })
    })
  })

  describe('submit hooks', () => {
    it('should return continue when no submit hooks are configured', async () => {
      // Arrange
      const fn = compiler.compileSubmitHooks(submitModel([]))
      const ctx = createContext(functionRegistry)

      // Act
      const result = await executeCompiledSubmitHooks(fn, ctx)

      // Assert
      expect(result).toEqual({ executed: false, validated: false, outcome: 'continue' })
    })

    it('should execute onValid after onAlways and return the first matching outcome', async () => {
      // Arrange
      const alwaysRedirect = ASTTestFactory.redirectOutcome({ goto: '/always' })
      const validRedirect = ASTTestFactory.redirectOutcome({ goto: '/valid' })
      const hook = ASTTestFactory.hook(HookType.SUBMIT)
        .withProperty('validate', true)
        .withProperty('validationGroups', ['default'])
        .withProperty('onAlways', {
          effects: [ASTTestFactory.functionExpression(FunctionType.EFFECT, 'submitEffect')],
          next: [alwaysRedirect],
        })
        .withProperty('onValid', {
          next: [validRedirect],
        })
        .build() as SubmitHookASTNode
      const fn = compiler.compileSubmitHooks(submitModel([hook]))
      const buildStepValidation = vi.fn(() => stubValidation({ fieldFailures: [], domainFailures: [] }))
      const ctx = createContext(functionRegistry, { buildStepValidation })

      // Act
      const result = await executeCompiledSubmitHooks(fn!, ctx)

      // Assert
      expect(ctx.data.submit).toBe('ran')
      expect(result).toEqual({
        executed: true,
        validated: false,
        outcome: 'redirect',
        redirect: '/always',
      })
      expect(buildStepValidation).not.toHaveBeenCalled()
    })

    it('should evaluate throwError outcomes for invalid submissions', async () => {
      // Arrange
      const errorOutcome = ASTTestFactory.throwErrorOutcome({
        status: 422,
        message: 'Invalid submission',
      })
      const hook = ASTTestFactory.hook(HookType.SUBMIT)
        .withProperty('validate', true)
        .withProperty('validationGroups', ['default'])
        .withProperty('onInvalid', {
          next: [errorOutcome],
        })
        .build() as SubmitHookASTNode
      const fn = compiler.compileSubmitHooks(submitModel([hook]))
      const ctx = createContext(functionRegistry, {
        buildStepValidation: vi.fn(() => stubValidation(invalidResult(['default']))),
      })

      // Act
      const result = await executeCompiledSubmitHooks(fn!, ctx)

      // Assert
      expect(result).toEqual({
        executed: true,
        validated: true,
        isValid: false,
        outcome: 'error',
        status: 422,
        message: 'Invalid submission',
      })
    })

    it('should compile hook validation groups into the submit validation task', async () => {
      // Arrange
      const hook = ASTTestFactory.hook(HookType.SUBMIT)
        .withProperty('validate', true)
        .withProperty('validationGroups', ['lookup'])
        .build() as SubmitHookASTNode
      const buildStepValidation = vi.fn(() => stubValidation({ fieldFailures: [], domainFailures: [] }))
      const fn = compiler.compileSubmitHooks(submitModel([hook]))
      const ctx = createContext(functionRegistry, { buildStepValidation })

      // Act
      const lifecycleTask = (await fn(ctx)) as SubmitLifecycleWorkTask
      const result = await executeCompiledSubmitHooks(fn, ctx)

      // Assert
      expect(lifecycleTask.props.hooks[0]?.props.validation?.props.groups).toEqual(['lookup'])
      expect(lifecycleTask.props.hooks[0]?.props.validation?.props.includeSubmissionOnly).toBe(true)
      expect(buildStepValidation).toHaveBeenCalledWith('submit-step', {
        groups: ['lookup'],
        includeSubmissionOnly: true,
      })
      expect(result).toEqual({
        executed: true,
        validated: true,
        isValid: true,
        outcome: 'continue',
      })
    })

    it('should run onAlways effects before validation', async () => {
      // Arrange
      const hook = ASTTestFactory.hook(HookType.SUBMIT)
        .withProperty('validate', true)
        .withProperty('validationGroups', ['default'])
        .withProperty('onAlways', {
          effects: [ASTTestFactory.functionExpression(FunctionType.EFFECT, 'submitEffect')],
        })
        .build() as SubmitHookASTNode
      const buildStepValidation = vi.fn(() => stubValidation({ fieldFailures: [], domainFailures: [] }))
      const fn = compiler.compileSubmitHooks(submitModel([hook]))
      const ctx = createContext(functionRegistry, { buildStepValidation })

      // Act
      const result = await executeCompiledSubmitHooks(fn!, ctx)

      // Assert
      expect(buildStepValidation).toHaveBeenCalledTimes(1)
      expect(ctx.data.submit).toBe('ran')
      expect(result).toMatchObject({ executed: true, validated: true, isValid: true })
    })
  })

  describe('source generation', () => {
    it('should compile async-aware hook source with effect context construction', () => {
      // Arrange
      const hook = ASTTestFactory.hook(HookType.ACCESS)
        .withProperty('effects', [ASTTestFactory.functionExpression(FunctionType.EFFECT, 'loadProfile')])
        .build() as AccessHookASTNode

      // Act
      const source = compiler.generateAccessSource(accessModel([hook]))

      // Assert
      expect(source).toContain('ctx.effectFunctionContext')
      expect(source).toContain('_forgeHelpers.evaluateFunctionAsync')
      expect(source).toContain('"loadProfile"')
    })

    it('should emit an async run function only when the effect function is async', () => {
      // Arrange
      const hook = ASTTestFactory.hook(HookType.ACCESS)
        .withProperty('effects', [
          ASTTestFactory.functionExpression(FunctionType.EFFECT, 'markAction'),
          ASTTestFactory.functionExpression(FunctionType.EFFECT, 'loadProfile'),
        ])
        .build() as AccessHookASTNode

      // Act
      const source = compiler.generateAccessSource(accessModel([hook]))

      // Assert
      expect(source).toContain('function runMarkAction')
      expect(source).not.toContain('async function runMarkAction')
      expect(source).toContain('async function runLoadProfile')
    })

    it('should emit sync when and next functions when no expression awaits', () => {
      // Arrange
      const hook = ASTTestFactory.hook(HookType.ACCESS)
        .withProperty('when', createPredicate('allowed'))
        .withProperty('next', [ASTTestFactory.redirectOutcome({ goto: '/login' })])
        .build() as AccessHookASTNode

      // Act
      const source = compiler.generateAccessSource(accessModel([hook]))

      // Assert
      expect(source).toContain('function evaluateAccessHookWhen')
      expect(source).toContain('function resolveAccessHookNext')
      expect(source).not.toContain('async')
    })
  })
})
