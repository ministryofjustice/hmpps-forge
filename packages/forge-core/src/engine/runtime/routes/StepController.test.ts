import { ASTNodeType } from '../../types/enums'
import { HookType } from '../../../authoring/types/enums'
import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import { AccessHookASTNode, SubmitHookASTNode } from '../../types/expressions.type'
import { ForgeDependencies, PackageDependencies, NodeId } from '../../types/engine.type'
import type {
  CompiledAccessHookResult as AccessHookResult,
  CompiledSubmitHookResult as SubmitHookResult,
} from '../../types/hookLifecycle.type'
import type { CompiledForm } from '../../types/compilationArtefacts.type'
import RuntimeEvaluationContext from '../context/RuntimeEvaluationContext'
import type { StepRuntimePlan } from '../../types/runtimePlans.type'
import StepController from './StepController'
import { StepRequest } from '../../../framework/types/request.type'
import { CookieMutation, CookieOptions, StepResponse } from '../../../framework/types/response.type'
import { JourneyRouteTemplateCatalog, StoredRouteTree } from '../types/routes.type'
import ContextPreparer from '../lifecycle/ContextPreparer'

type MockInvocationResult<T> = { value: T; error?: undefined } | { value?: undefined; error: unknown }
type MockLifecycleInvoke = (<T>(
  nodeId: NodeId,
  context: RuntimeEvaluationContext,
) => Promise<MockInvocationResult<T>>) &
  ReturnType<typeof vi.fn>

interface MockLifecycleInvoker {
  invoke: MockLifecycleInvoke
  invokeSync: ReturnType<typeof vi.fn>
}

const createMockRequest = (
  overrides: Partial<{
    method: 'GET' | 'POST'
    url: string
    session: unknown
    state: Record<string, unknown>
    headers: Record<string, string | string[] | undefined>
    cookies: Record<string, string | undefined>
    params: Record<string, string>
    query: Record<string, string | string[]>
    post: Record<string, string | string[]>
  }> = {},
): StepRequest => {
  const headers = overrides.headers ?? {}
  const cookies = overrides.cookies ?? {}
  const params = overrides.params ?? {}
  const query = overrides.query ?? {}
  const post = overrides.post ?? {}
  const session = overrides.session
  const state = overrides.state ?? {}
  const url = overrides.url ?? 'http://localhost/forms/journey/step-1'
  const parsedUrl = new URL(url, 'http://localhost')

  return {
    method: overrides.method ?? 'GET',
    url,
    baseUrl: '/forms/journey',
    location: {
      origin: parsedUrl.origin,
      href: parsedUrl.href,
      pathname: parsedUrl.pathname,
      basePath: '/forms/journey',
    },

    getHeader: (name: string) => headers[name.toLowerCase()],
    getAllHeaders: () => headers,
    getCookie: (name: string) => cookies[name],
    getAllCookies: () => cookies,
    getParam: (name: string) => params[name],
    getParams: () => params,
    getQuery: (name: string) => query[name],
    getAllQuery: () => query,
    getPost: (name: string) => post[name],
    getAllPost: () => post,
    getSession: () => session,
    getState: (key: string) => state[key],
    getAllState: () => state,
  }
}

const createMockResponse = (): StepResponse => {
  const responseHeaders = new Map<string, string>()
  const responseCookies = new Map<string, CookieMutation>()

  return {
    setHeader: (name: string, value: string) => {
      responseHeaders.set(name, value)
    },
    getHeader: (name: string) => responseHeaders.get(name),
    getAllHeaders: () => responseHeaders,
    setCookie: (name: string, value: string, options?: CookieOptions) => {
      responseCookies.set(name, { value, options })
    },
    getCookie: (name: string) => responseCookies.get(name),
    getAllCookies: () => responseCookies,
  }
}

const mockContextPreparerPrepare = vi.fn()

vi.mock('../lifecycle/ContextPreparer', () => ({
  __esModule: true,
  default: vi.fn(function MockContextPreparer() {
    return {
      prepare: (...args: unknown[]) => mockContextPreparerPrepare(...args),
    }
  }),
}))

describe('StepController', () => {
  let mockCompiledForm: CompiledForm[number]
  let mockPackageDependencies: Mocked<PackageDependencies>
  let mockForgeDependencies: Mocked<ForgeDependencies>
  let mockRouteTree: StoredRouteTree
  let mockCurrentStepPath: string
  let mockRouteTemplateCatalog: JourneyRouteTemplateCatalog
  let mockReq: unknown
  let mockRes: unknown
  let mockEvaluator: MockLifecycleInvoker
  let mockContext: Mocked<RuntimeEvaluationContext>
  let mockAncestorNodes: (JourneyASTNode | StepASTNode)[]

  beforeEach(() => {
    ASTTestFactory.resetIds()
    mockContextPreparerPrepare.mockReset()
    ;(ContextPreparer as unknown as Mock).mockClear()

    mockCurrentStepPath = '/journey/step-1'
    mockRouteTree = []
    mockRouteTemplateCatalog = {
      routeTemplatePathByStepId: new Map(),
      stepIdByRouteTemplatePath: new Map(),
    }

    mockPackageDependencies = {
      componentRegistry: {} as any,
      functionRegistry: {} as any,
    } as unknown as Mocked<PackageDependencies>

    mockForgeDependencies = {
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      frameworkAdapter: {
        redirect: vi.fn(),
        render: vi.fn().mockResolvedValue(undefined),
        toStepRequest: vi.fn().mockImplementation(() => createMockRequest()),
        toStepResponse: vi.fn().mockImplementation(createMockResponse),
      },
    } as unknown as Mocked<ForgeDependencies>

    mockReq = {}
    mockRes = {}
    mockAncestorNodes = []

    mockContext = {
      request: {
        url: 'http://localhost/forms/journey/step-1',
        method: 'GET',
        location: {
          origin: 'http://localhost',
          pathname: '/forms/journey/step-1',
          href: 'http://localhost/forms/journey/step-1',
          basePath: '/forms/journey',
        },
        getParams: vi.fn().mockReturnValue({}),
        getSession: vi.fn().mockReturnValue(undefined),
        getAllQuery: vi.fn().mockReturnValue({}),
        getAllHeaders: vi.fn().mockReturnValue({}),
        getAllCookies: vi.fn().mockReturnValue({}),
        getAllState: vi.fn().mockReturnValue({}),
        getAllPost: vi.fn().mockReturnValue({}),
      },
      global: {
        answers: {},
        data: {},
        validation: undefined,
      },
    } as unknown as Mocked<RuntimeEvaluationContext>

    mockEvaluator = {
      invoke: vi.fn(),
      invokeSync: vi.fn(),
    } as unknown as MockLifecycleInvoker
    mockContextPreparerPrepare.mockReturnValue(mockContext)
  })

  function createCompiledForm(stepNode: StepASTNode): CompiledForm[number] {
    const submitHookIds = (stepNode.properties.onSubmission ?? []).map(hook => hook.id)
    const runtimePlan: StepRuntimePlan = {
      stepId: stepNode.id,
      path: stepNode.properties.path.replace(/^\//, ''),
      staticData: {},
      compiledAccessLifecycle: async () => {
        for (const ancestor of mockAncestorNodes) {
          for (const hook of ancestor?.properties.onAccess ?? []) {
            const result = await mockEvaluator.invoke<AccessHookResult>(hook.id, mockContext)

            if (result.error || !result.value?.executed) {
              continue
            }

            if (result.value.outcome === 'redirect' || result.value.outcome === 'error') {
              return result.value
            }
          }
        }

        return { executed: true, outcome: 'continue' }
      },
      compiledSubmitHooks: async () => {
        for (const hookId of submitHookIds) {
          const result = await mockEvaluator.invoke<SubmitHookResult>(hookId, mockContext)

          if (!result.error && result.value?.executed) {
            return result.value
          }
        }

        return { executed: false, validated: false, outcome: 'continue' }
      },
    }

    const routeTemplatePath = `/journey/${stepNode.properties.path.replace(/^\//, '')}`

    mockRouteTemplateCatalog = {
      routeTemplatePathByStepId: new Map([[stepNode.id, routeTemplatePath]]),
      stepIdByRouteTemplatePath: new Map([[routeTemplatePath, stepNode.id]]),
    }
    const reachableStep = stepNode.properties.code
      ? { path: routeTemplatePath, code: stepNode.properties.code }
      : { path: routeTemplatePath }

    return {
      runtimePlan,
      compiledAnswerPreparation: () => {},
      compiledValidation: () => ({ isValid: true, fieldFailures: [], domainFailures: [] }),
      compiledRender: () => ({
        blocks: [],
        step: { path: stepNode.properties.path, title: stepNode.properties.title },
        ancestors: [],
      }),
      navigationPlan: {
        entries: [
          {
            stepId: stepNode.id,
            code: stepNode.properties.code,
            isEntryPoint: true,
            hasValidation: false,
          },
        ],
        resumeConfigured: false,
        unreachableRedirect: 'entry',
        reachabilityDisabled: false,
        compiledStepValidations: new Map(),
        compiledNavigation: async () => ({
          evaluation: {
            currentStepId: stepNode.id,
            steps: [
              {
                stepId: stepNode.id,
                routeTemplatePath,
                code: stepNode.properties.code,
                declarationIndex: 0,
                isEntryPoint: true,
                isConditionalEntry: false,
                hasValidation: false,
                isReachable: true,
                isValid: true,
                forwardRouteTemplatePaths: [],
                predecessorRouteTemplatePaths: [],
              },
            ],
            defaultEntryRouteTemplatePath: routeTemplatePath,
            frontierRouteTemplatePath: undefined,
            canonicalPathRouteTemplatePaths: [routeTemplatePath],
            progressExists: false,
            resumeActive: false,
            resumeOutcome: 'no-op' as const,
            unreachableRedirect: 'entry' as const,
          },
          reachability: {
            reachableSteps: [reachableStep],
            unreachableSteps: [],
          },
        }),
      },
    }
  }

  function createStepWithHooks(options: {
    code?: string
    onAccess?: AccessHookASTNode[]
    onSubmission?: SubmitHookASTNode[]
  }): StepASTNode {
    return {
      type: ASTNodeType.STEP,
      id: ASTTestFactory.getId(),
      properties: {
        path: '/step-1',
        code: options.code,
        title: 'Test Step',
        ...options,
      },
    } as StepASTNode
  }

  function createJourneyWithHooks(options: { onAccess?: AccessHookASTNode[] }): JourneyASTNode {
    return {
      type: ASTNodeType.JOURNEY,
      id: ASTTestFactory.getId(),
      properties: {
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        ...options,
      },
    } as JourneyASTNode
  }

  function setupAncestorChain(ancestors: (JourneyASTNode | StepASTNode)[]): void {
    mockAncestorNodes = ancestors
  }

  describe('get()', () => {
    describe('lifecycle hooks', () => {
      it('should run access hooks for step and continue when guards pass', async () => {
        // Arrange
        const accessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
        const step = createStepWithHooks({ onAccess: [accessHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const accessResult: AccessHookResult = { executed: true, outcome: 'continue' }
        mockEvaluator.invoke.mockResolvedValue({
          value: accessResult,
          metadata: { source: 'test', timestamp: Date.now() },
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.get(mockReq, mockRes)

        // Assert
        expect(mockEvaluator.invoke).toHaveBeenCalledWith(accessHook.id, mockContext)
        expect(mockForgeDependencies.frameworkAdapter.render).toHaveBeenCalled()
      })

      it('should throw error when access fails with error outcome', async () => {
        // Arrange
        const accessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
        const step = createStepWithHooks({ onAccess: [accessHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const accessResult: AccessHookResult = { executed: true, outcome: 'error', status: 403 }
        mockEvaluator.invoke.mockResolvedValue({
          value: accessResult,
          metadata: { source: 'test', timestamp: Date.now() },
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act & Assert
        await expect(controller.get(mockReq, mockRes)).rejects.toThrow('Access denied')
      })

      it('should redirect when access returns redirect outcome', async () => {
        // Arrange
        const accessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
        const step = createStepWithHooks({ onAccess: [accessHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const accessResult: AccessHookResult = { executed: true, outcome: 'redirect', redirect: 'login' }
        mockEvaluator.invoke.mockResolvedValue({
          value: accessResult,
          metadata: { source: 'test', timestamp: Date.now() },
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.get(mockReq, mockRes)

        // Assert
        expect(mockForgeDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, '/forms/journey/login')
      })

      it('should run access lifecycle for all ancestors in order', async () => {
        // Arrange
        const journeyAccessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
        const stepAccessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode

        const journey = createJourneyWithHooks({
          onAccess: [journeyAccessHook],
        })
        const step = createStepWithHooks({
          onAccess: [stepAccessHook],
        })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([journey, step])

        const invocationOrder: string[] = []
        mockEvaluator.invoke.mockImplementation(async (nodeId: NodeId) => {
          invocationOrder.push(nodeId)

          return {
            value: { executed: true, outcome: 'continue' },
            metadata: { source: 'test', timestamp: Date.now() },
          }
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.get(mockReq, mockRes)

        // Assert - Journey access hooks should run before step access hooks
        const journeyAccessIndex = invocationOrder.indexOf(journeyAccessHook.id)
        const stepAccessIndex = invocationOrder.indexOf(stepAccessHook.id)

        expect(journeyAccessIndex).toBeLessThan(stepAccessIndex)
      })

      it('should stop at first access hook that halts with redirect', async () => {
        // Arrange
        const journeyAccessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
        const stepAccessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode

        const journey = createJourneyWithHooks({ onAccess: [journeyAccessHook] })
        const step = createStepWithHooks({ onAccess: [stepAccessHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([journey, step])

        mockEvaluator.invoke.mockImplementation(async (nodeId: NodeId) => {
          if (nodeId === journeyAccessHook.id) {
            return {
              value: { executed: true, outcome: 'redirect', redirect: 'unauthorized' },
              metadata: { source: 'test', timestamp: Date.now() },
            }
          }

          return {
            value: { executed: true, outcome: 'continue' },
            metadata: { source: 'test', timestamp: Date.now() },
          }
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.get(mockReq, mockRes)

        // Assert - Step access should never be called
        expect(mockEvaluator.invoke).not.toHaveBeenCalledWith(stepAccessHook.id, expect.anything())
        expect(mockForgeDependencies.frameworkAdapter.redirect).toHaveBeenCalled()
      })
    })

    describe('rendering', () => {
      it('should render after passing access checks', async () => {
        // Arrange
        const step = createStepWithHooks({})
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.get(mockReq, mockRes)

        // Assert
        expect(mockForgeDependencies.frameworkAdapter.render).toHaveBeenCalled()
      })

      it('should render entry validation errors when validateOnEntry groups are active', async () => {
        // Arrange
        const step = createStepWithHooks({})
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        mockCompiledForm.compiledEntryValidation = vi.fn().mockReturnValue(['contact'])
        mockCompiledForm.compiledValidation = vi.fn().mockReturnValue({
          isValid: false,
          fieldFailures: [
            {
              blockId: 'compile_ast:999' as NodeId,
              blockCode: 'email',
              passed: false,
              message: 'Enter your email',
              submissionOnly: false,
            },
          ],
          domainFailures: [],
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.get(mockReq, mockRes)

        // Assert
        expect(mockCompiledForm.compiledValidation).toHaveBeenCalledWith(expect.anything(), false, ['contact'])
        expect(mockContext.global.validation).toMatchObject({
          stepId: mockCompiledForm.runtimePlan.stepId,
          validated: true,
          groups: ['contact'],
          isSubmission: false,
          isValid: false,
        })
        expect(mockForgeDependencies.frameworkAdapter.render).toHaveBeenCalledWith(
          expect.objectContaining({
            showValidationFailures: true,
            fieldValidationErrors: [
              {
                blockCode: 'email',
                passed: false,
                message: 'Enter your email',
                submissionOnly: false,
              },
            ],
          }),
          mockReq,
          mockRes,
        )
      })

      it('should not run entry validation when no validateOnEntry groups are active', async () => {
        // Arrange
        const step = createStepWithHooks({})
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        mockCompiledForm.compiledEntryValidation = vi.fn().mockReturnValue([])
        mockCompiledForm.compiledValidation = vi.fn().mockReturnValue({
          isValid: false,
          fieldFailures: [],
          domainFailures: [],
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.get(mockReq, mockRes)

        // Assert
        expect(mockCompiledForm.compiledValidation).not.toHaveBeenCalled()
        expect(mockContext.global.validation).toBeUndefined()
      })
    })
  })

  describe('post()', () => {
    beforeEach(() => {
      ;(mockForgeDependencies.frameworkAdapter.toStepRequest as Mock).mockImplementation(() =>
        createMockRequest({
          method: 'POST',
          post: { fieldName: 'value' },
        }),
      )
    })

    describe('lifecycle hooks', () => {
      it('should run same access lifecycle as GET before action/submit', async () => {
        // Arrange
        const accessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
        const step = createStepWithHooks({ onAccess: [accessHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        mockEvaluator.invoke.mockResolvedValue({
          value: { executed: true, outcome: 'continue' },
          metadata: { source: 'test', timestamp: Date.now() },
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockEvaluator.invoke).toHaveBeenCalledWith(accessHook.id, mockContext)
      })

      it('should throw error when access fails on POST', async () => {
        // Arrange
        const accessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
        const step = createStepWithHooks({ onAccess: [accessHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        mockEvaluator.invoke.mockResolvedValue({
          value: { executed: true, outcome: 'error', status: 403 },
          metadata: { source: 'test', timestamp: Date.now() },
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act & Assert
        await expect(controller.post(mockReq, mockRes)).rejects.toThrow('Access denied')
      })

      it('should call compiled answer preparation function on POST', async () => {
        // Arrange
        const step = createStepWithHooks({})
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const answerPrepSpy = vi.fn()

        mockCompiledForm.compiledAnswerPreparation = answerPrepSpy

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(answerPrepSpy).toHaveBeenCalledTimes(1)
        const ctx = answerPrepSpy.mock.calls[0][0]

        expect(ctx.answers).toBeDefined()
        expect(ctx.post).toBeDefined()
        expect(ctx.conditions).toBeDefined()
      })

      it('should pass post values to compiled render on POST', async () => {
        // Arrange
        const step = createStepWithHooks({})
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const compiledRenderSpy = vi.fn(() => ({
          blocks: [],
          step: { path: step.properties.path, title: step.properties.title },
          ancestors: [],
        }))

        mockContext.request.getAllPost = vi.fn().mockReturnValue({ fieldName: 'value' })
        mockCompiledForm.compiledRender = compiledRenderSpy

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(compiledRenderSpy).toHaveBeenCalledTimes(1)
        expect(compiledRenderSpy).toHaveBeenCalledWith(expect.objectContaining({ post: { fieldName: 'value' } }))
      })

      it('should await async compiled answer preparation before reachability evaluation on POST', async () => {
        // Arrange
        const step = createStepWithHooks({})
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const compiledNavigationSpy = vi.fn(async ctx => {
          expect(ctx.answers.prepared.current).toBe('yes')

          return {
            evaluation: {
              currentStepId: step.id,
              steps: [],
              defaultEntryRouteTemplatePath: undefined,
              frontierRouteTemplatePath: undefined,
              canonicalPathRouteTemplatePaths: [],
              progressExists: false,
              resumeActive: false,
              resumeOutcome: 'no-op' as const,
              unreachableRedirect: 'entry' as const,
            },
          }
        })

        mockCompiledForm.compiledAnswerPreparation = async ctx => {
          await Promise.resolve()
          ctx.answers.prepared = { current: 'yes', mutations: [] }
        }
        mockCompiledForm.navigationPlan.compiledNavigation = compiledNavigationSpy

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(compiledNavigationSpy).toHaveBeenCalledTimes(1)
      })

      it('should expose journey reachability to submit hooks after answers are prepared', async () => {
        // Arrange
        const submitHook = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
        const step = createStepWithHooks({ code: 'test-step', onSubmission: [submitHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        mockCompiledForm.navigationPlan = {
          entries: [
            {
              stepId: step.id,
              code: 'test-step',
              isEntryPoint: true,
              hasValidation: false,
            },
          ],
          resumeConfigured: false,
          unreachableRedirect: 'entry',
          reachabilityDisabled: false,
          compiledStepValidations: new Map(),
          compiledNavigation: async () => ({
            evaluation: {
              currentStepId: step.id,
              steps: [],
              defaultEntryRouteTemplatePath: undefined,
              frontierRouteTemplatePath: undefined,
              canonicalPathRouteTemplatePaths: [],
              progressExists: false,
              resumeActive: false,
              resumeOutcome: 'no-op' as const,
              unreachableRedirect: 'entry' as const,
            },
            reachability: {
              reachableSteps: [{ path: '/journey/step-1', code: 'test-step' }],
              unreachableSteps: [],
            },
          }),
        }

        mockEvaluator.invoke.mockImplementation(async (nodeId: NodeId, context?: RuntimeEvaluationContext) => {
          if (nodeId === submitHook.id) {
            expect(context?.global.reachability).toEqual({
              reachableSteps: [{ path: '/journey/step-1', code: 'test-step' }],
              unreachableSteps: [],
            })

            const submitResult: SubmitHookResult = {
              executed: true,
              validated: false,
              outcome: 'continue',
            }

            return {
              value: submitResult,
              metadata: { source: 'test', timestamp: Date.now() },
            }
          }

          return {
            value: { executed: false },
            metadata: { source: 'test', timestamp: Date.now() },
          }
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockContext.global.reachability).toEqual({
          reachableSteps: [{ path: '/journey/step-1', code: 'test-step' }],
          unreachableSteps: [],
        })
      })

      it('should redirect unreachable POST requests to configured frontier before submit hooks run', async () => {
        // Arrange
        const submitHook = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
        const step = createStepWithHooks({ onSubmission: [submitHook] })
        mockCompiledForm = createCompiledForm(step)
        mockCompiledForm.navigationPlan.unreachableRedirect = 'frontier'
        mockCompiledForm.navigationPlan.compiledNavigation = async () => ({
          evaluation: {
            currentStepId: step.id,
            steps: [
              {
                stepId: step.id,
                routeTemplatePath: '/journey/step-1',
                declarationIndex: 0,
                isEntryPoint: false,
                isConditionalEntry: false,
                hasValidation: false,
                isReachable: false,
                isValid: true,
                forwardRouteTemplatePaths: [],
                predecessorRouteTemplatePaths: [],
              },
            ],
            defaultEntryRouteTemplatePath: '/journey/start',
            frontierRouteTemplatePath: '/journey/frontier',
            canonicalPathRouteTemplatePaths: ['/journey/start', '/journey/frontier'],
            progressExists: true,
            resumeActive: false,
            resumeOutcome: 'no-op' as const,
            unreachableRedirect: 'frontier' as const,
          },
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockForgeDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, '/journey/frontier')
        expect(mockEvaluator.invoke).not.toHaveBeenCalledWith(submitHook.id, mockContext)
        expect(mockForgeDependencies.frameworkAdapter.render).not.toHaveBeenCalled()
      })
    })

    describe('submit hooks', () => {
      it('should expose validation callback to submit hooks when validation is required', async () => {
        // Arrange
        const submitHook = ASTTestFactory.hook(HookType.SUBMIT)
          .withProperty('validate', true)
          .build() as SubmitHookASTNode
        const step = createStepWithHooks({ onSubmission: [submitHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        mockCompiledForm.compiledValidation = async () => ({
          isValid: false,
          fieldFailures: [
            {
              blockId: 'compile_ast:999' as NodeId,
              blockCode: 'email',
              passed: false,
              message: 'Enter an email address',
              submissionOnly: true,
            },
          ],
          domainFailures: [],
        })
        mockCompiledForm.runtimePlan.compiledSubmitHooks = async hookContext => {
          const validation = await hookContext.validate?.(['default'])

          return {
            executed: true,
            validated: true,
            isValid: validation?.isValid,
            outcome: 'continue',
          }
        }

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockContext.global.validation).toEqual({
          stepId: mockCompiledForm.runtimePlan.stepId,
          validated: true,
          groups: ['default'],
          isSubmission: true,
          isValid: false,
          fieldFailures: [
            {
              blockId: 'compile_ast:999',
              blockCode: 'email',
              passed: false,
              message: 'Enter an email address',
              submissionOnly: true,
            },
          ],
          domainFailures: [],
        })
      })

      it('should not pre-validate before submit hooks', async () => {
        // Arrange
        const submitHook = ASTTestFactory.hook(HookType.SUBMIT)
          .withProperty('validate', true)
          .build() as SubmitHookASTNode
        const step = createStepWithHooks({ onSubmission: [submitHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        mockCompiledForm.compiledValidation = vi.fn().mockReturnValue({
          isValid: false,
          fieldFailures: [],
          domainFailures: [],
        })
        mockCompiledForm.runtimePlan.compiledSubmitHooks = async () => ({
          executed: true,
          validated: false,
          outcome: 'continue',
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockCompiledForm.compiledValidation).not.toHaveBeenCalled()
        expect(mockContext.global.validation).toBeUndefined()
      })

      it('should run submit hooks after actions', async () => {
        // Arrange
        const submitHook = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
        const step = createStepWithHooks({ onSubmission: [submitHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const submitResult: SubmitHookResult = { executed: true, validated: false, outcome: 'continue' }
        mockEvaluator.invoke.mockResolvedValue({
          value: submitResult,
          metadata: { source: 'test', timestamp: Date.now() },
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockEvaluator.invoke).toHaveBeenCalledWith(submitHook.id, mockContext)
      })

      it('should redirect when submit has next path', async () => {
        // Arrange
        const submitHook = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
        const step = createStepWithHooks({ onSubmission: [submitHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const submitResult: SubmitHookResult = {
          executed: true,
          validated: false,
          outcome: 'redirect',
          redirect: 'next-step',
        }
        mockEvaluator.invoke.mockResolvedValue({
          value: submitResult,
          metadata: { source: 'test', timestamp: Date.now() },
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockForgeDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(
          mockRes,
          '/forms/journey/next-step',
        )
        expect(mockForgeDependencies.frameworkAdapter.render).not.toHaveBeenCalled()
      })

      it('should redirect with absolute URL when next is absolute', async () => {
        // Arrange
        const submitHook = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
        const step = createStepWithHooks({ onSubmission: [submitHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const submitResult: SubmitHookResult = {
          executed: true,
          validated: false,
          outcome: 'redirect',
          redirect: '/absolute/path',
        }
        mockEvaluator.invoke.mockResolvedValue({
          value: submitResult,
          metadata: { source: 'test', timestamp: Date.now() },
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockForgeDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, '/absolute/path')
      })

      it('should redirect with external URL when next contains protocol', async () => {
        // Arrange
        const submitHook = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
        const step = createStepWithHooks({ onSubmission: [submitHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const submitResult: SubmitHookResult = {
          executed: true,
          validated: false,
          outcome: 'redirect',
          redirect: 'https://external.com/path',
        }
        mockEvaluator.invoke.mockResolvedValue({
          value: submitResult,
          metadata: { source: 'test', timestamp: Date.now() },
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockForgeDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(
          mockRes,
          'https://external.com/path',
        )
      })

      it('should render with validation errors when validated=true and no next', async () => {
        // Arrange
        const submitHook = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
        const step = createStepWithHooks({ onSubmission: [submitHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const submitResult: SubmitHookResult = {
          executed: true,
          validated: true,
          isValid: false,
          outcome: 'continue',
        }
        mockEvaluator.invoke.mockResolvedValue({
          value: submitResult,
          metadata: { source: 'test', timestamp: Date.now() },
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockForgeDependencies.frameworkAdapter.render).toHaveBeenCalled()
        expect(mockForgeDependencies.frameworkAdapter.redirect).not.toHaveBeenCalled()
      })

      it('should render without validation flags when no submit hooks execute', async () => {
        // Arrange
        const submitHook = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
        const step = createStepWithHooks({ onSubmission: [submitHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const submitResult: SubmitHookResult = { executed: false, validated: false, outcome: 'continue' }
        mockEvaluator.invoke.mockResolvedValue({
          value: submitResult,
          metadata: { source: 'test', timestamp: Date.now() },
        })

        const controller = new StepController(
          mockCompiledForm,
          mockPackageDependencies,
          mockForgeDependencies,
          mockRouteTree,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockForgeDependencies.frameworkAdapter.render).toHaveBeenCalled()
      })
    })
  })

  describe('redirect handling', () => {
    it('should prepend base URL for relative redirects', async () => {
      // Arrange
      const accessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const step = createStepWithHooks({ onAccess: [accessHook] })
      mockCompiledForm = createCompiledForm(step)

      setupAncestorChain([step])

      mockEvaluator.invoke.mockResolvedValue({
        value: { executed: true, outcome: 'redirect', redirect: 'relative-path' },
        metadata: { source: 'test', timestamp: Date.now() },
      })

      const controller = new StepController(
        mockCompiledForm,
        mockPackageDependencies,
        mockForgeDependencies,
        mockRouteTree,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockForgeDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(
        mockRes,
        '/forms/journey/relative-path',
      )
    })

    it('should not prepend base URL for absolute paths starting with /', async () => {
      // Arrange
      const accessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const step = createStepWithHooks({ onAccess: [accessHook] })
      mockCompiledForm = createCompiledForm(step)

      setupAncestorChain([step])

      mockEvaluator.invoke.mockResolvedValue({
        value: { executed: true, outcome: 'redirect', redirect: '/absolute-path' },
        metadata: { source: 'test', timestamp: Date.now() },
      })

      const controller = new StepController(
        mockCompiledForm,
        mockPackageDependencies,
        mockForgeDependencies,
        mockRouteTree,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockForgeDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, '/absolute-path')
    })

    it('should not prepend base URL for URLs with protocol', async () => {
      // Arrange
      const accessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const step = createStepWithHooks({ onAccess: [accessHook] })
      mockCompiledForm = createCompiledForm(step)

      setupAncestorChain([step])

      mockEvaluator.invoke.mockResolvedValue({
        value: { executed: true, outcome: 'redirect', redirect: 'http://example.com/path' },
        metadata: { source: 'test', timestamp: Date.now() },
      })

      const controller = new StepController(
        mockCompiledForm,
        mockPackageDependencies,
        mockForgeDependencies,
        mockRouteTree,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockForgeDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, 'http://example.com/path')
    })
  })

  describe('request data building', () => {
    it('should pass request data to evaluator context', async () => {
      // Arrange
      const step = createStepWithHooks({})
      mockCompiledForm = createCompiledForm(step)

      setupAncestorChain([step])

      const customRequest = createMockRequest({
        method: 'POST',
        post: { field1: 'value1' },
        query: { param1: 'value1' },
        params: { id: '123' },
        url: 'http://localhost/journey/step-1',
        session: { userId: 'user-1' },
        state: { key: 'value' },
      })

      ;(mockForgeDependencies.frameworkAdapter.toStepRequest as Mock).mockReturnValue(customRequest)

      const controller = new StepController(
        mockCompiledForm,
        mockPackageDependencies,
        mockForgeDependencies,
        mockRouteTree,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.post(mockReq, mockRes)

      // Assert
      expect(mockContextPreparerPrepare).toHaveBeenCalledWith(
        mockCompiledForm.runtimePlan,
        customRequest,
        expect.objectContaining({
          setHeader: expect.any(Function),
          setCookie: expect.any(Function),
        }),
      )
    })
  })

  describe('effect handling', () => {
    it('should invoke access hooks which execute effects internally', async () => {
      // Arrange
      const accessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const step = createStepWithHooks({ onAccess: [accessHook] })
      mockCompiledForm = createCompiledForm(step)

      setupAncestorChain([step])

      const accessResult: AccessHookResult = { executed: true, outcome: 'continue' }

      mockEvaluator.invoke.mockResolvedValue({
        value: accessResult,
        metadata: { source: 'test', timestamp: Date.now() },
      })

      const controller = new StepController(
        mockCompiledForm,
        mockPackageDependencies,
        mockForgeDependencies,
        mockRouteTree,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.get(mockReq, mockRes)

      // Assert - Access hook was invoked (effects execute internally)
      expect(mockEvaluator.invoke).toHaveBeenCalledWith(accessHook.id, mockContext)
    })

    it('should invoke submit hooks which execute effects internally', async () => {
      // Arrange
      const submitHook = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
      const step = createStepWithHooks({ onSubmission: [submitHook] })
      mockCompiledForm = createCompiledForm(step)

      setupAncestorChain([step])

      const submitResult: SubmitHookResult = {
        executed: true,
        validated: false,
        outcome: 'redirect',
        redirect: 'next',
      }

      mockEvaluator.invoke.mockResolvedValue({
        value: submitResult,
        metadata: { source: 'test', timestamp: Date.now() },
      })
      ;(mockForgeDependencies.frameworkAdapter.toStepRequest as Mock).mockReturnValue(
        createMockRequest({ method: 'POST' }),
      )

      const controller = new StepController(
        mockCompiledForm,
        mockPackageDependencies,
        mockForgeDependencies,
        mockRouteTree,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.post(mockReq, mockRes)

      // Assert - Submit hook was invoked (effects execute internally)
      expect(mockEvaluator.invoke).toHaveBeenCalledWith(submitHook.id, mockContext)
    })
  })

  describe('edge cases', () => {
    it('should handle step with no hooks', async () => {
      // Arrange
      const step = createStepWithHooks({})
      mockCompiledForm = createCompiledForm(step)

      setupAncestorChain([step])

      const controller = new StepController(
        mockCompiledForm,
        mockPackageDependencies,
        mockForgeDependencies,
        mockRouteTree,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.get(mockReq, mockRes)

      // Assert - Should still render successfully
      expect(mockForgeDependencies.frameworkAdapter.render).toHaveBeenCalled()
    })

    it('should handle multiple access hooks', async () => {
      // Arrange
      const access1 = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const access2 = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const step = createStepWithHooks({ onAccess: [access1, access2] })
      mockCompiledForm = createCompiledForm(step)

      setupAncestorChain([step])

      mockEvaluator.invoke.mockResolvedValue({
        value: { executed: true, outcome: 'continue' },
        metadata: { source: 'test', timestamp: Date.now() },
      })

      const controller = new StepController(
        mockCompiledForm,
        mockPackageDependencies,
        mockForgeDependencies,
        mockRouteTree,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.get(mockReq, mockRes)

      // Assert - Both access hooks should be invoked
      expect(mockEvaluator.invoke).toHaveBeenCalledWith(access1.id, mockContext)
      expect(mockEvaluator.invoke).toHaveBeenCalledWith(access2.id, mockContext)
    })

    it('should handle deeply nested journey hierarchy', async () => {
      // Arrange
      const outerJourney = createJourneyWithHooks({
        onAccess: [ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode],
      })
      const innerJourney = createJourneyWithHooks({
        onAccess: [ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode],
      })
      const step = createStepWithHooks({
        onAccess: [ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode],
      })
      mockCompiledForm = createCompiledForm(step)

      setupAncestorChain([outerJourney, innerJourney, step])

      mockEvaluator.invoke.mockResolvedValue({
        value: { executed: true, outcome: 'continue' },
        metadata: { source: 'test', timestamp: Date.now() },
      })

      const controller = new StepController(
        mockCompiledForm,
        mockPackageDependencies,
        mockForgeDependencies,
        mockRouteTree,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.get(mockReq, mockRes)

      // Assert - All three access hooks should be invoked
      expect(mockEvaluator.invoke).toHaveBeenCalledTimes(3)
    })
  })

})
