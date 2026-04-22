import { ASTNodeType } from '../../types/enums'
import { HookType } from '../../../authoring/types/enums'
import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import { AccessHookASTNode, ActionHookASTNode, SubmitHookASTNode } from '../../types/expressions.type'
import { JourneyInstanceDependencies, NodeId, AstNodeId } from '../../types/engine.type'
import { AccessHookResult } from '../../nodes/hooks/access/AccessHandler'
import { SubmitHookResult } from '../../nodes/hooks/submit/SubmitHandler'
import { ActionHookResult } from '../../nodes/hooks/action/ActionHandler'
import { CompiledForm } from '../../compilation/CompilationFactory'
import { JourneyMetadata } from '../../../framework/rendering/types'
import ThunkEvaluator from '../../compilation/thunks/ThunkEvaluator'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { PseudoNodeType } from '../../types/pseudoNodes.type'
import { StepRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import RuntimeExpansionService from '../expansion/RuntimeExpansionService'
import StepValidityAnalyzer from '../validation/StepValidityAnalyzer'
import RenderProjector from '../rendering/RenderProjector'
import StepController from './StepController'
import { StepRequest } from '../../../framework/types/request.type'
import { CookieMutation, CookieOptions, StepResponse } from '../../../framework/types/response.type'
import { JourneyRouteTemplateCatalog } from './routes.type'

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

vi.mock('../../compilation/thunks/ThunkEvaluator')

const mockRenderProjectorBuild = vi.fn().mockResolvedValue({ step: {}, blocks: [], ancestors: [] })
const mockStepValidityAnalyzerExecute = vi.fn().mockResolvedValue({
  isValid: true,
  fieldFailures: [],
  domainFailures: [],
})

vi.mock('../validation/StepValidityAnalyzer', () => {
  return {
    __esModule: true,
    default: vi.fn(function MockStepValidityAnalyzer() {
      return {
        execute(...args: unknown[]) {
          return mockStepValidityAnalyzerExecute(...args)
        },
      }
    }),
  }
})

vi.mock('../rendering/RenderProjector', () => {
  return {
    __esModule: true,
    default: vi.fn(function MockRenderProjector() {
      return {
        build(...args: unknown[]) {
          return mockRenderProjectorBuild(...args)
        },
      }
    }),
  }
})

describe('StepController', () => {
  let mockCompiledForm: CompiledForm[number]
  let mockDependencies: Mocked<JourneyInstanceDependencies>
  let mockNavigationMetadata: JourneyMetadata[]
  let mockCurrentStepPath: string
  let mockRouteTemplateCatalog: JourneyRouteTemplateCatalog
  let mockReq: unknown
  let mockRes: unknown
  let mockEvaluator: Mocked<ThunkEvaluator>
  let mockContext: Mocked<ThunkEvaluationContext>

  beforeEach(() => {
    ASTTestFactory.resetIds()
    mockRenderProjectorBuild.mockClear()
    mockStepValidityAnalyzerExecute.mockClear()
    ;(StepValidityAnalyzer as unknown as Mock).mockClear()
    ;(RenderProjector as unknown as Mock).mockClear()
    mockRenderProjectorBuild.mockResolvedValue({ step: {}, blocks: [], ancestors: [] })
    mockStepValidityAnalyzerExecute.mockResolvedValue({
      isValid: true,
      fieldFailures: [],
      domainFailures: [],
    })

    mockCurrentStepPath = '/journey/step-1'
    mockNavigationMetadata = []
    mockRouteTemplateCatalog = {
      routeTemplatePathByStepId: new Map(),
      stepIdByRouteTemplatePath: new Map(),
    }

    mockDependencies = {
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
      componentRegistry: {} as any,
      functionRegistry: {} as any,
    } as unknown as Mocked<JourneyInstanceDependencies>

    mockReq = {}
    mockRes = {}

    mockContext = {
      request: {
        getParams: vi.fn().mockReturnValue({}),
      },
      metadataRegistry: {
        get: vi.fn(),
        findNodesWhere: vi.fn().mockReturnValue([]),
      },
      nodeRegistry: {
        get: vi.fn(),
        findByType: vi.fn().mockReturnValue([]),
      },
      functionRegistry: {
        get: vi.fn().mockReturnValue({ evaluate: vi.fn() }),
        getAll: vi.fn().mockReturnValue(new Map()),
      },
      global: {
        answers: {},
        data: {},
        validation: undefined,
      },
      runtimeExpansionState: {
        preparedIterators: new Map(),
        expandedIteratorIds: new Set(),
      },
      runtimeCompilationDependencies: {
        nodeRegistry: { get: vi.fn() },
        metadataRegistry: { get: vi.fn() },
      },
    } as unknown as Mocked<ThunkEvaluationContext>

    mockEvaluator = {
      createContext: vi.fn().mockReturnValue(mockContext),
      invoke: vi.fn(),
      invokeSync: vi.fn(),
    } as unknown as Mocked<ThunkEvaluator>
    ;(ThunkEvaluator.withRuntimeOverlay as Mock).mockReturnValue(mockEvaluator)
  })

  function createCompiledForm(stepNode: StepASTNode): CompiledForm[number] {
    const runtimePlan: StepRuntimePlan = {
      stepId: stepNode.id,
      path: stepNode.properties.path.replace(/^\//, ''),
      code: stepNode.properties.code,
      accessAncestorIds: [stepNode.id],
      actionHookIds: (stepNode.properties.onAction ?? []).map(hook => hook.id),
      submitHookIds: (stepNode.properties.onSubmission ?? []).map(hook => hook.id),
      iterateNodeIds: [],
      validationBlockIds: [],
      domainValidationNodeIds: [],
      renderAncestorIds: [],
      renderStepId: stepNode.id,
      hasValidatingSubmitHook: (stepNode.properties.onSubmission ?? []).some(
        (t: SubmitHookASTNode) => t.properties.validate === true,
      ),
      hasDomainValidation: false,
    }

    const routeTemplatePath = `/journey/${stepNode.properties.path.replace(/^\//, '')}`

    mockRouteTemplateCatalog = {
      routeTemplatePathByStepId: new Map([[stepNode.id, routeTemplatePath]]),
      stepIdByRouteTemplatePath: new Map([[routeTemplatePath, stepNode.id]]),
    }

    return {
      artefact: {
        nodeRegistry: {
          get: vi.fn((nodeId: NodeId) => {
            if (nodeId === stepNode.id) {
              return stepNode
            }

            return (stepNode.properties.onSubmission ?? []).find(hook => hook.id === nodeId)
          }),
        },
        metadataRegistry: {
          get: vi.fn(),
        },
      } as any,
      currentStepId: stepNode.id,
      runtimePlan,
      reachabilityPlan: {
        entries: [
          {
            stepId: stepNode.id,
            path: stepNode.properties.path.replace(/^\//, ''),
            code: stepNode.properties.code,
            isEntryPoint: true,
            entryWhenNodeId: undefined,
            forwardOutcomeIds: [],
            hasValidation: false,
            cleardownFieldCodes: [],
            iterateNodeIds: [],
            validationBlockIds: [],
            domainValidationNodeIds: [],
            reachabilityTieBreakers: [],
          },
        ],
        resumeAlways: false,
        reachabilityDisabled: false,
      },
    }
  }

  function createStepWithHooks(options: {
    code?: string
    onAccess?: AccessHookASTNode[]
    onAction?: ActionHookASTNode[]
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
    const ancestorIds = ancestors.map(a => a.id) as AstNodeId[]

    if (mockCompiledForm) {
      mockCompiledForm.runtimePlan.accessAncestorIds = ancestorIds
      mockCompiledForm.runtimePlan.renderAncestorIds = ancestorIds.slice(0, -1)
    }

    mockContext.metadataRegistry.get = vi.fn().mockImplementation((nodeId: NodeId, key: string) => {
      if (key === 'attachedToParentNode') {
        const index = ancestorIds.indexOf(nodeId as AstNodeId)

        if (index > 0) {
          return ancestorIds[index - 1]
        }
      }

      return undefined
    })

    mockContext.nodeRegistry.get = vi.fn().mockImplementation((nodeId: NodeId) => {
      return ancestors.find(a => a.id === nodeId)
    })
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
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.get(mockReq, mockRes)

        // Assert
        expect(mockEvaluator.invoke).toHaveBeenCalledWith(accessHook.id, mockContext)
        expect(mockDependencies.frameworkAdapter.render).toHaveBeenCalled()
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
          mockDependencies,
          mockNavigationMetadata,
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
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.get(mockReq, mockRes)

        // Assert
        expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, '/forms/journey/login')
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
          mockDependencies,
          mockNavigationMetadata,
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
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.get(mockReq, mockRes)

        // Assert - Step access should never be called
        expect(mockEvaluator.invoke).not.toHaveBeenCalledWith(stepAccessHook.id, expect.anything())
        expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalled()
      })
    })

    describe('rendering', () => {
      it('should call render projector and render after passing access checks', async () => {
        // Arrange
        const step = createStepWithHooks({})
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const controller = new StepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.get(mockReq, mockRes)

        // Assert
        expect(mockRenderProjectorBuild).toHaveBeenCalledTimes(1)
        expect(mockDependencies.frameworkAdapter.render).toHaveBeenCalled()
      })
    })
  })

  describe('post()', () => {
    beforeEach(() => {
      ;(mockDependencies.frameworkAdapter.toStepRequest as Mock).mockImplementation(() =>
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
          mockDependencies,
          mockNavigationMetadata,
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
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act & Assert
        await expect(controller.post(mockReq, mockRes)).rejects.toThrow('Access denied')
      })

      it('should evaluate dynamic answer pseudo nodes after iterator expansion on POST', async () => {
        // Arrange
        const dynamicAnswerNode: { id: NodeId; type: PseudoNodeType.ANSWER_LOCAL } = {
          id: 'runtime_pseudo:1',
          type: PseudoNodeType.ANSWER_LOCAL,
        }

        const step = createStepWithHooks({})
        mockCompiledForm = createCompiledForm(step)
        mockCompiledForm.runtimePlan.iterateNodeIds = ['compile_ast:iterate' as NodeId]

        let expansionCalled = false

        mockContext.nodeRegistry.findByType = vi.fn().mockImplementation((type: string) => {
          if (type === PseudoNodeType.ANSWER_LOCAL && expansionCalled) {
            return [dynamicAnswerNode]
          }

          return []
        })

        Object.defineProperty(mockContext, 'runtimeExpansionState', {
          value: {
            preparedIterators: new Map(),
            expandedIteratorIds: new Set(),
          },
          writable: true,
        })

        mockContext.nodeRegistry.get = vi.fn().mockImplementation((nodeId: NodeId) => {
          if (nodeId === step.id) {
            return step
          }

          return undefined
        })

        mockEvaluator.invoke.mockImplementation(async (nodeId: NodeId) => {
          if (nodeId === dynamicAnswerNode.id) {
            return {
              value: 'dynamic answer',
              metadata: { source: 'test', timestamp: Date.now() },
            }
          }

          return {
            value: { executed: false },
            metadata: { source: 'test', timestamp: Date.now() },
          }
        })

        // Simulate expansion registering ANSWER_LOCAL nodes
        const originalExpandIteratorRoots = RuntimeExpansionService.prototype.expandIteratorRoots
        RuntimeExpansionService.prototype.expandIteratorRoots = async function expandIteratorRoots() {
          expansionCalled = true

          return []
        }

        const controller = new StepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(expansionCalled).toBe(true)
        expect(mockEvaluator.invoke).toHaveBeenCalledWith(dynamicAnswerNode.id, mockContext)

        // Restore
        RuntimeExpansionService.prototype.expandIteratorRoots = originalExpandIteratorRoots
      })

      it('should expose journey reachability to submit hooks after answers are prepared', async () => {
        // Arrange
        const submitHook = ASTTestFactory.hook(HookType.SUBMIT).build() as SubmitHookASTNode
        const step = createStepWithHooks({ code: 'test-step', onSubmission: [submitHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        mockCompiledForm.reachabilityPlan = {
          entries: [
            {
              stepId: step.id,
              path: 'step-1',
              code: 'test-step',
              isEntryPoint: true,
              entryWhenNodeId: undefined,
              forwardOutcomeIds: [],
              hasValidation: false,
              cleardownFieldCodes: [],
              iterateNodeIds: [],
              validationBlockIds: [],
              domainValidationNodeIds: [],
              reachabilityTieBreakers: [],
            },
          ],
          resumeAlways: false,
          reachabilityDisabled: false,
        }

        mockEvaluator.invoke.mockImplementation(async (nodeId: NodeId, context?: ThunkEvaluationContext) => {
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
          mockDependencies,
          mockNavigationMetadata,
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
    })

    describe('action hooks', () => {
      it('should run action hooks after access passes', async () => {
        // Arrange
        const actionHook = ASTTestFactory.hook(HookType.ACTION).build() as ActionHookASTNode
        const step = createStepWithHooks({ onAction: [actionHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const actionResult: ActionHookResult = { executed: true }
        mockEvaluator.invoke.mockResolvedValue({
          value: actionResult,
          metadata: { source: 'test', timestamp: Date.now() },
        })

        const controller = new StepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockEvaluator.invoke).toHaveBeenCalledWith(actionHook.id, mockContext)
      })

      it('should stop at first executing action (first-match semantics)', async () => {
        // Arrange
        const action1 = ASTTestFactory.hook(HookType.ACTION).build() as ActionHookASTNode
        const action2 = ASTTestFactory.hook(HookType.ACTION).build() as ActionHookASTNode
        const step = createStepWithHooks({ onAction: [action1, action2] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        mockEvaluator.invoke.mockImplementation(async (nodeId: NodeId) => {
          if (nodeId === action1.id) {
            return {
              value: { executed: true },
              metadata: { source: 'test', timestamp: Date.now() },
            }
          }

          return { value: { executed: false }, metadata: { source: 'test', timestamp: Date.now() } }
        })

        const controller = new StepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert - Only first action should be invoked
        expect(mockEvaluator.invoke).toHaveBeenCalledWith(action1.id, mockContext)
        expect(mockEvaluator.invoke).not.toHaveBeenCalledWith(action2.id, expect.anything())
      })
    })

    describe('submit hooks', () => {
      it('should run StepValidityAnalyzer before submit hooks when a submit hook requires validation', async () => {
        const submitHook = ASTTestFactory.hook(HookType.SUBMIT)
          .withProperty('validate', true)
          .build() as SubmitHookASTNode
        const step = createStepWithHooks({ onSubmission: [submitHook] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const submitResult: SubmitHookResult = {
          executed: true,
          validated: true,
          isValid: false,
          outcome: 'continue',
        }
        mockStepValidityAnalyzerExecute.mockResolvedValue({
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
        mockEvaluator.invoke.mockResolvedValue({
          value: submitResult,
          metadata: { source: 'test', timestamp: Date.now() },
        })

        const controller = new StepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        await controller.post(mockReq, mockRes)

        expect(mockStepValidityAnalyzerExecute).toHaveBeenCalledTimes(1)
        expect(mockStepValidityAnalyzerExecute).toHaveBeenCalledWith(
          mockCompiledForm.runtimePlan,
          mockEvaluator,
          mockContext,
          true,
        )
        expect(mockContext.global.validation).toEqual({
          stepId: mockCompiledForm.runtimePlan.stepId,
          validated: true,
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
          mockDependencies,
          mockNavigationMetadata,
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
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, '/forms/journey/next-step')
        expect(mockDependencies.frameworkAdapter.render).not.toHaveBeenCalled()
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
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, '/absolute/path')
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
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, 'https://external.com/path')
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
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockDependencies.frameworkAdapter.render).toHaveBeenCalled()
        expect(mockDependencies.frameworkAdapter.redirect).not.toHaveBeenCalled()
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
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
          mockRouteTemplateCatalog,
        )

        // Act
        await controller.post(mockReq, mockRes)

        // Assert
        expect(mockDependencies.frameworkAdapter.render).toHaveBeenCalled()
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
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, '/forms/journey/relative-path')
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
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, '/absolute-path')
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
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.get(mockReq, mockRes)

      // Assert
      expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalledWith(mockRes, 'http://example.com/path')
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

      ;(mockDependencies.frameworkAdapter.toStepRequest as Mock).mockReturnValue(customRequest)

      const controller = new StepController(
        mockCompiledForm,
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.post(mockReq, mockRes)

      // Assert
      expect(mockEvaluator.createContext).toHaveBeenCalledWith(
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
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.get(mockReq, mockRes)

      // Assert - Access hook was invoked (effects execute internally)
      expect(mockEvaluator.invoke).toHaveBeenCalledWith(accessHook.id, mockContext)
    })

    it('should invoke action hooks which execute effects internally', async () => {
      // Arrange
      const actionHook = ASTTestFactory.hook(HookType.ACTION).build() as ActionHookASTNode
      const step = createStepWithHooks({ onAction: [actionHook] })
      mockCompiledForm = createCompiledForm(step)

      setupAncestorChain([step])

      const actionResult: ActionHookResult = { executed: true }

      mockEvaluator.invoke.mockResolvedValue({
        value: actionResult,
        metadata: { source: 'test', timestamp: Date.now() },
      })
      ;(mockDependencies.frameworkAdapter.toStepRequest as Mock).mockReturnValue(createMockRequest({ method: 'POST' }))

      const controller = new StepController(
        mockCompiledForm,
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.post(mockReq, mockRes)

      // Assert - Action hook was invoked (effects execute internally)
      expect(mockEvaluator.invoke).toHaveBeenCalledWith(actionHook.id, mockContext)
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
      ;(mockDependencies.frameworkAdapter.toStepRequest as Mock).mockReturnValue(createMockRequest({ method: 'POST' }))

      const controller = new StepController(
        mockCompiledForm,
        mockDependencies,
        mockNavigationMetadata,
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
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.get(mockReq, mockRes)

      // Assert - Should still render successfully
      expect(mockDependencies.frameworkAdapter.render).toHaveBeenCalled()
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
        mockDependencies,
        mockNavigationMetadata,
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
        mockDependencies,
        mockNavigationMetadata,
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
