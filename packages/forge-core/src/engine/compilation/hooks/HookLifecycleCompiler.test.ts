import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import { FunctionType, HookType, PredicateType } from '../../../authoring/types/enums'
import FunctionRegistry from '../../registries/FunctionRegistry'
import { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import { AccessHookASTNode, ActionHookASTNode, SubmitHookASTNode } from '../../types/expressions.type'
import { TestPredicateASTNode } from '../../types/predicates.type'
import { NodeId } from '../../types/ast.type'
import type { StepRequest } from '../../../framework/types/request.type'
import type { StepResponse } from '../../../framework/types/response.type'
import HookLifecycleCompiler, { HookLifecycleContext } from './HookLifecycleCompiler'

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
    compiler = new HookLifecycleCompiler()
    functionRegistry = new FunctionRegistry()
    functionRegistry.register({
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
      const fn = compiler.compileAccessLifecycle([createStep([hook])], functionRegistry)
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
      const fn = compiler.compileAccessLifecycle([createJourney([outerHook]), createStep([stepHook])], functionRegistry)
      const ctx = createContext(functionRegistry)

      // Act
      const result = await fn!(ctx)

      // Assert
      expect(ctx.data.action).toBe('ran')
      expect(result).toEqual({ executed: true, outcome: 'redirect', redirect: '/login' })
    })
  })

  describe('action hooks', () => {
    it('should use first-match semantics for action hooks', async () => {
      // Arrange
      const skipped = ASTTestFactory.hook(HookType.ACTION)
        .withProperty('when', createPredicate('missing'))
        .withProperty('effects', [ASTTestFactory.functionExpression(FunctionType.EFFECT, 'markAction')])
        .build() as ActionHookASTNode
      const matched = ASTTestFactory.hook(HookType.ACTION)
        .withProperty('when', createPredicate('clicked'))
        .withProperty('effects', [ASTTestFactory.functionExpression(FunctionType.EFFECT, 'markAction')])
        .build() as ActionHookASTNode
      const fn = compiler.compileActionHooks([skipped, matched], functionRegistry)
      const ctx = createContext(functionRegistry, {
        answers: { clicked: { current: 'yes', mutations: [] } },
      })

      // Act
      const result = await fn!(ctx)

      // Assert
      expect(result).toEqual({ executed: true })
      expect(ctx.data.action).toBe('ran')
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
      const fn = compiler.compileSubmitHooks([hook], functionRegistry)
      const ctx = createContext(functionRegistry, {
        validation: {
          stepId: 'compile_ast:step' as NodeId,
          validated: true,
          isValid: true,
          fieldFailures: [],
          domainFailures: [],
        },
      })

      // Act
      const result = await fn!(ctx)

      // Assert
      expect(ctx.data.submit).toBe('ran')
      expect(result).toEqual({
        executed: true,
        validated: true,
        isValid: true,
        outcome: 'redirect',
        redirect: '/always',
      })
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
      const fn = compiler.compileSubmitHooks([hook], functionRegistry)
      const ctx = createContext(functionRegistry, {
        validation: {
          stepId: 'compile_ast:step' as NodeId,
          validated: true,
          isValid: false,
          fieldFailures: [],
          domainFailures: [],
        },
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
  })

  describe('source generation', () => {
    it('should compile async-aware hook source with effect context construction', () => {
      // Arrange
      const hook = ASTTestFactory.hook(HookType.ACCESS)
        .withProperty('effects', [ASTTestFactory.functionExpression(FunctionType.EFFECT, 'loadProfile')])
        .build() as AccessHookASTNode

      // Act
      const source = compiler.generateAccessSource([createStep([hook])], functionRegistry)

      // Assert
      expect(source).toContain('new EffectFunctionContext')
      expect(source).toContain('await ctx.conditions.get("loadProfile").evaluate')
    })
  })
})
