import { ASTTestFactory } from '../../../testing-helpers/ASTTestFactory'
import { FunctionType, HookType, PredicateType } from '../../../../../authoring/types/enums'
import { FormatGeneratorsRegistry } from '../../../../../authoring/generators/formatGenerators'
import FunctionRegistry from '../../../../registries/FunctionRegistry'
import { JourneyASTNode, StepASTNode } from '../../../../types/structures.type'
import { AccessHookASTNode, SubmitHookASTNode } from '../../../../types/expressions.type'
import { TestPredicateASTNode } from '../../../../types/predicates.type'
import type { StepRequest } from '../../../../../framework/types/request.type'
import type { StepResponse } from '../../../../../framework/types/response.type'
import { getForgeRuntimeEvaluationDiagnostics } from '../../../../errors/ForgeRuntimeEvaluationError'
import type { HookLifecycleContext } from '../../../../types/hookLifecycle.type'
import HookLifecycleCompiler from './HookLifecycleCompiler'

function createPredicate(answerCode: string, functionName = 'isRequired'): TestPredicateASTNode {
  return ASTTestFactory.predicate(PredicateType.TEST, {
    subject: ASTTestFactory.reference(['answers', answerCode]),
    condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, functionName),
  }) as TestPredicateASTNode
}

function createStep(onAccess: StepASTNode['properties']['onAccess'] = []): StepASTNode {
  return ASTTestFactory.step()
    .withPath('/step')
    .withTitle('Step')
    .withProperty('onAccess', onAccess)
    .build()
}

function createJourney(onAccess: JourneyASTNode['properties']['onAccess'] = []): JourneyASTNode {
  return ASTTestFactory.journey()
    .withProperty('path', '/journey')
    .withProperty('onAccess', onAccess)
    .build()
}

function createContext(
  functionRegistry: FunctionRegistry,
  overrides: Partial<HookLifecycleContext> = {},
): HookLifecycleContext {
  const answers = overrides.answers ?? {}
  const data = overrides.data ?? {}
  const request = {
    url: 'http://localhost/forms/journey/step',
    method: 'POST',
    location: {
      origin: 'http://localhost',
      pathname: '/forms/journey/step',
      href: 'http://localhost/forms/journey/step',
      basePath: '/forms/journey',
    },
    getParams: () => ({}),
    getSession: () => undefined,
    getAllQuery: () => ({}),
    getAllHeaders: () => ({}),
    getAllCookies: () => ({}),
    getAllState: () => ({}),
    getAllPost: () => ({}),
    getParam: () => undefined,
    getQuery: () => undefined,
    getHeader: () => undefined,
    getCookie: () => undefined,
    getPost: () => undefined,
    getState: () => undefined,
  } as unknown as StepRequest
  const response = {
    setHeader: vi.fn(),
    getHeader: vi.fn(),
    getAllHeaders: vi.fn(() => new Map()),
    setCookie: vi.fn(),
    getCookie: vi.fn(),
    getAllCookies: vi.fn(() => new Map()),
  } as unknown as StepResponse

  return {
    answers,
    data,
    validation: overrides.validation,
    session: {},
    params: {},
    query: {},
    post: {},
    request: { url: request.url, path: request.location.pathname, method: request.method },
    conditions: functionRegistry,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    validate: vi.fn(async () => ({
      isValid: overrides.validation?.isValid ?? true,
      fieldFailures: overrides.validation?.fieldFailures ?? [],
      domainFailures: overrides.validation?.domainFailures ?? [],
    })),
    effectContext: {
      global: {
        answers,
        data,
      },
      request,
      response,
    },
    ...overrides,
  }
}

describe('HookLifecycleCompiler', () => {
  let compiler: HookLifecycleCompiler
  let functionRegistry: FunctionRegistry

  beforeEach(() => {
    ASTTestFactory.resetIds()
    functionRegistry = new FunctionRegistry()
    compiler = new HookLifecycleCompiler({ functionRegistry })
    functionRegistry.register({
      ...FormatGeneratorsRegistry,
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
    it('should execute access effects and return continue when no outcome matches', async () => {
      // Arrange
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'loadProfile')
      const hook = ASTTestFactory.hook(HookType.ACCESS)
        .withProperty('when', createPredicate('allowed'))
        .withProperty('effects', [effect])
        .build() as AccessHookASTNode
      const fn = compiler.compileAccessLifecycle([createStep([hook])])
      const ctx = createContext(functionRegistry, {
        answers: { allowed: { current: 'yes', mutations: [] } },
      })

      // Act
      const result = await fn!(ctx)

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
      const fn = compiler.compileAccessLifecycle([createJourney([outerHook]), createStep([stepHook])])
      const ctx = createContext(functionRegistry)

      // Act
      const result = await fn!(ctx)

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
      const fn = compiler.compileAccessLifecycle([createStep([hook])])
      const ctx = createContext(functionRegistry, {
        data: { redirectPath: '/sentence-plan' },
      })

      // Act
      const result = await fn!(ctx)

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
      const fn = compiler.compileAccessLifecycle([createJourney([loadHook, redirectHook])])
      const ctx = createContext(functionRegistry, {
        data: { profileId: 'ABC123' },
      })

      // Act
      const result = await fn!(ctx)

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
      const fn = compiler.compileAccessLifecycle([createStep([hook])])
      const ctx = createContext(functionRegistry)

      // Act
      let thrown: unknown

      try {
        await fn!(ctx)
      } catch (error) {
        thrown = error
      }

      // Assert
      if (!(thrown instanceof Error)) {
        throw new Error('Expected throwingEffect to throw the original Error')
      }

      expect(thrown.message).toBe('Effect failed')
      expect(getForgeRuntimeEvaluationDiagnostics(thrown)).toMatchObject({
        phase: 'hooks',
        functionName: 'throwingEffect',
        functionType: FunctionType.EFFECT,
      })
    })
  })

  describe('submit hooks', () => {
    it('should execute onValid after onAlways and return the first matching outcome', async () => {
      // Arrange
      const alwaysRedirect = ASTTestFactory.redirectOutcome({ goto: '/always' })
      const validRedirect = ASTTestFactory.redirectOutcome({ goto: '/valid' })
      const hook = ASTTestFactory.hook(HookType.SUBMIT)
        .withProperty('validate', true)
        .withProperty('onAlways', {
          effects: [ASTTestFactory.functionExpression(FunctionType.EFFECT, 'submitEffect')],
          next: [alwaysRedirect],
        })
        .withProperty('onValid', {
          next: [validRedirect],
        })
        .build() as SubmitHookASTNode
      const fn = compiler.compileSubmitHooks([hook])
      const ctx = createContext(functionRegistry, {
        validate: vi.fn(async () => ({ isValid: true, fieldFailures: [], domainFailures: [] })),
      })

      // Act
      const result = await fn!(ctx)

      // Assert
      expect(ctx.data.submit).toBe('ran')
      expect(result).toEqual({
        executed: true,
        validated: false,
        outcome: 'redirect',
        redirect: '/always',
      })
      expect(ctx.validate).not.toHaveBeenCalled()
    })

    it('should evaluate throwError outcomes for invalid submissions', async () => {
      // Arrange
      const errorOutcome = ASTTestFactory.throwErrorOutcome({
        status: 422,
        message: 'Invalid submission',
      })
      const hook = ASTTestFactory.hook(HookType.SUBMIT)
        .withProperty('validate', true)
        .withProperty('onInvalid', {
          next: [errorOutcome],
        })
        .build() as SubmitHookASTNode
      const fn = compiler.compileSubmitHooks([hook])
      const ctx = createContext(functionRegistry, {
        validate: vi.fn(async () => ({ isValid: false, fieldFailures: [], domainFailures: [] })),
      })

      // Act
      const result = await fn!(ctx)

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

    it('should call validation callback with hook validation groups', async () => {
      // Arrange
      const hook = ASTTestFactory.hook(HookType.SUBMIT)
        .withProperty('validate', true)
        .withProperty('validationGroups', ['lookup'])
        .build() as SubmitHookASTNode
      const validate = vi.fn(async () => ({ isValid: true, fieldFailures: [], domainFailures: [] }))
      const fn = compiler.compileSubmitHooks([hook])
      const ctx = createContext(functionRegistry, { validate })

      // Act
      const result = await fn!(ctx)

      // Assert
      expect(validate).toHaveBeenCalledWith(['lookup'])
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
      const validate = vi.fn(async () => ({ isValid: true, fieldFailures: [], domainFailures: [] }))
      const fn = compiler.compileSubmitHooks([hook])
      const ctx = createContext(functionRegistry, { validate })

      // Act
      const result = await fn!(ctx)

      // Assert
      expect(validate).toHaveBeenCalledTimes(1)
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
      const source = compiler.generateAccessSource([createStep([hook])])

      // Assert
      expect(source).toContain('new EffectFunctionContext')
      expect(source).toContain('_forgeHelpers.evaluateFunctionAsync')
      expect(source).toContain('"loadProfile"')
    })
  })
})
