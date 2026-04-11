import { ASTNodeType } from '../../types/enums'
import { ExpressionType, IteratorType, TransitionType } from '../../../authoring/types/enums'
import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import {
  AccessTransitionASTNode,
  ActionTransitionASTNode,
  ExpressionASTNode,
  SubmitTransitionASTNode,
} from '../../types/expressions.type'
import { JourneyInstanceDependencies, NodeId, AstNodeId } from '../../types/engine.type'
import { AccessTransitionResult } from '../../nodes/transitions/access/AccessHandler'
import { SubmitTransitionResult } from '../../nodes/transitions/submit/SubmitHandler'
import { ActionTransitionResult } from '../../nodes/transitions/action/ActionHandler'
import { CompiledForm } from '../../compilation/CompilationFactory'
import { JourneyMetadata } from '../../../framework/rendering/types'
import ThunkEvaluator from '../../compilation/thunks/ThunkEvaluator'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { PseudoNodeType } from '../../types/pseudoNodes.type'
import { StepRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import StepValidityAnalyzer from '../evaluation/StepValidityAnalyzer'
import RenderProjector from '../projection/RenderProjector'
import StepController from './StepController'
import { StepRequest } from '../../../framework/types/request.type'
import { CookieMutation, CookieOptions, StepResponse } from '../../../framework/types/response.type'
import { JourneyRouteTemplateCatalog } from '../types/routes.type'

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

jest.mock('../../compilation/thunks/ThunkEvaluator')

const mockRenderProjectorBuild = jest.fn().mockResolvedValue({ step: {}, blocks: [], ancestors: [] })
const mockStepValidityAnalyzerExecute = jest.fn().mockResolvedValue({
  isValid: true,
  fieldFailures: [],
  domainFailures: [],
})

jest.mock('../evaluation/StepValidityAnalyzer', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      execute: (...args: unknown[]) => mockStepValidityAnalyzerExecute(...args),
    })),
  }
})

jest.mock('../projection/RenderProjector', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      build: (...args: unknown[]) => mockRenderProjectorBuild(...args),
    })),
  }
})

describe('StepController', () => {
  let mockCompiledForm: CompiledForm[number]
  let mockDependencies: jest.Mocked<JourneyInstanceDependencies>
  let mockNavigationMetadata: JourneyMetadata[]
  let mockCurrentStepPath: string
  let mockRouteTemplateCatalog: JourneyRouteTemplateCatalog
  let mockReq: unknown
  let mockRes: unknown
  let mockEvaluator: jest.Mocked<ThunkEvaluator>
  let mockContext: jest.Mocked<ThunkEvaluationContext>

  beforeEach(() => {
    ASTTestFactory.resetIds()
    mockRenderProjectorBuild.mockClear()
    mockStepValidityAnalyzerExecute.mockClear()
    ;(StepValidityAnalyzer as unknown as jest.Mock).mockClear()
    ;(RenderProjector as unknown as jest.Mock).mockClear()
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
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      frameworkAdapter: {
        redirect: jest.fn(),
        render: jest.fn().mockResolvedValue(undefined),
        toStepRequest: jest.fn().mockImplementation(() => createMockRequest()),
        toStepResponse: jest.fn().mockImplementation(createMockResponse),
      },
      componentRegistry: {} as any,
      functionRegistry: {} as any,
    } as unknown as jest.Mocked<JourneyInstanceDependencies>

    mockReq = {}
    mockRes = {}

    mockContext = {
      request: {
        getParams: jest.fn().mockReturnValue({}),
      },
      metadataRegistry: {
        get: jest.fn(),
        findNodesWhere: jest.fn().mockReturnValue([]),
      },
      nodeRegistry: {
        get: jest.fn(),
        findByType: jest.fn().mockReturnValue([]),
      },
      functionRegistry: {
        get: jest.fn().mockReturnValue({ evaluate: jest.fn() }),
        getAll: jest.fn().mockReturnValue(new Map()),
      },
      global: {
        answers: {},
        data: {},
        validation: undefined,
      },
    } as unknown as jest.Mocked<ThunkEvaluationContext>

    mockEvaluator = {
      createContext: jest.fn().mockReturnValue(mockContext),
      invoke: jest.fn(),
      invokeSync: jest.fn(),
    } as unknown as jest.Mocked<ThunkEvaluator>
    ;(ThunkEvaluator.withRuntimeOverlay as jest.Mock).mockReturnValue(mockEvaluator)
  })

  function createCompiledForm(stepNode: StepASTNode): CompiledForm[number] {
    const runtimePlan: StepRuntimePlan = {
      stepId: stepNode.id,
      path: stepNode.properties.path.replace(/^\//, ''),
      code: stepNode.properties.code,
      accessAncestorIds: [stepNode.id],
      actionTransitionIds: (stepNode.properties.onAction ?? []).map(transition => transition.id),
      submitTransitionIds: (stepNode.properties.onSubmission ?? []).map(transition => transition.id),
      fieldIteratorRootIds: [],
      validationIterateNodeIds: [],
      validationBlockIds: [],
      domainValidationNodeIds: [],
      renderAncestorIds: [],
      renderStepId: stepNode.id,
      hasValidatingSubmitTransition: (stepNode.properties.onSubmission ?? []).some(
        (t: SubmitTransitionASTNode) => t.properties.validate === true,
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
          get: jest.fn((nodeId: NodeId) => {
            if (nodeId === stepNode.id) {
              return stepNode
            }

            return (stepNode.properties.onSubmission ?? []).find(transition => transition.id === nodeId)
          }),
        },
        metadataRegistry: {
          get: jest.fn(),
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
            forwardOutcomeIds: [],
            hasValidation: false,
            cleardownFieldCodes: [],
            fieldIteratorRootIds: [],
            validationIterateNodeIds: [],
            validationBlockIds: [],
            domainValidationNodeIds: [],
          },
        ],
      },
    }
  }

  function createStepWithTransitions(options: {
    code?: string
    onAccess?: AccessTransitionASTNode[]
    onAction?: ActionTransitionASTNode[]
    onSubmission?: SubmitTransitionASTNode[]
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

  function createJourneyWithTransitions(options: { onAccess?: AccessTransitionASTNode[] }): JourneyASTNode {
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

    mockContext.metadataRegistry.get = jest.fn().mockImplementation((nodeId: NodeId, key: string) => {
      if (key === 'attachedToParentNode') {
        const index = ancestorIds.indexOf(nodeId as AstNodeId)

        if (index > 0) {
          return ancestorIds[index - 1]
        }
      }

      return undefined
    })

    mockContext.nodeRegistry.get = jest.fn().mockImplementation((nodeId: NodeId) => {
      return ancestors.find(a => a.id === nodeId)
    })
  }

  describe('get()', () => {
    describe('lifecycle transitions', () => {
      it('should run access transitions for step and continue when guards pass', async () => {
        // Arrange
        const accessTransition = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
        const step = createStepWithTransitions({ onAccess: [accessTransition] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const accessResult: AccessTransitionResult = { executed: true, outcome: 'continue' }
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
        expect(mockEvaluator.invoke).toHaveBeenCalledWith(accessTransition.id, mockContext)
        expect(mockDependencies.frameworkAdapter.render).toHaveBeenCalled()
      })

      it('should throw error when access fails with error outcome', async () => {
        // Arrange
        const accessTransition = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
        const step = createStepWithTransitions({ onAccess: [accessTransition] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const accessResult: AccessTransitionResult = { executed: true, outcome: 'error', status: 403 }
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
        const accessTransition = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
        const step = createStepWithTransitions({ onAccess: [accessTransition] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const accessResult: AccessTransitionResult = { executed: true, outcome: 'redirect', redirect: 'login' }
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
        const journeyAccessTransition = ASTTestFactory.transition(
          TransitionType.ACCESS,
        ).build() as AccessTransitionASTNode
        const stepAccessTransition = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode

        const journey = createJourneyWithTransitions({
          onAccess: [journeyAccessTransition],
        })
        const step = createStepWithTransitions({
          onAccess: [stepAccessTransition],
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

        // Assert - Journey access transitions should run before step access transitions
        const journeyAccessIndex = invocationOrder.indexOf(journeyAccessTransition.id)
        const stepAccessIndex = invocationOrder.indexOf(stepAccessTransition.id)

        expect(journeyAccessIndex).toBeLessThan(stepAccessIndex)
      })

      it('should stop at first access transition that halts with redirect', async () => {
        // Arrange
        const journeyAccessTransition = ASTTestFactory.transition(
          TransitionType.ACCESS,
        ).build() as AccessTransitionASTNode
        const stepAccessTransition = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode

        const journey = createJourneyWithTransitions({ onAccess: [journeyAccessTransition] })
        const step = createStepWithTransitions({ onAccess: [stepAccessTransition] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([journey, step])

        mockEvaluator.invoke.mockImplementation(async (nodeId: NodeId) => {
          if (nodeId === journeyAccessTransition.id) {
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
        expect(mockEvaluator.invoke).not.toHaveBeenCalledWith(stepAccessTransition.id, expect.anything())
        expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalled()
      })
    })

    describe('rendering', () => {
      it('should call render projector and render after passing access checks', async () => {
        // Arrange
        const step = createStepWithTransitions({})
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
      ;(mockDependencies.frameworkAdapter.toStepRequest as jest.Mock).mockImplementation(() =>
        createMockRequest({
          method: 'POST',
          post: { fieldName: 'value' },
        }),
      )
    })

    describe('lifecycle transitions', () => {
      it('should run same access lifecycle as GET before action/submit', async () => {
        // Arrange
        const accessTransition = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
        const step = createStepWithTransitions({ onAccess: [accessTransition] })
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
        expect(mockEvaluator.invoke).toHaveBeenCalledWith(accessTransition.id, mockContext)
      })

      it('should throw error when access fails on POST', async () => {
        // Arrange
        const accessTransition = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
        const step = createStepWithTransitions({ onAccess: [accessTransition] })
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
        const iterateNode = ASTTestFactory.expression(ExpressionType.ITERATE)
          .withId('compile_ast:iterate')
          .withProperty('input', { id: 'compile_ast:input', type: ASTNodeType.EXPRESSION })
          .withProperty('iterator', { type: IteratorType.MAP })
          .build() as ExpressionASTNode

        const dynamicAnswerNode: { id: NodeId; type: PseudoNodeType.ANSWER_LOCAL } = {
          id: 'runtime_pseudo:1',
          type: PseudoNodeType.ANSWER_LOCAL,
        }

        const step = createStepWithTransitions({})
        mockCompiledForm = createCompiledForm(step)
        mockCompiledForm.runtimePlan.fieldIteratorRootIds = [iterateNode.id]

        let iteratorExpanded = false

        mockContext.nodeRegistry.get = jest.fn().mockImplementation((nodeId: NodeId) => {
          if (nodeId === iterateNode.id) {
            return iterateNode
          }

          if (nodeId === step.id) {
            return step
          }

          return undefined
        })

        mockContext.nodeRegistry.findByType = jest.fn().mockImplementation((type: string) => {
          if (type === PseudoNodeType.ANSWER_LOCAL && iteratorExpanded) {
            return [dynamicAnswerNode]
          }

          return []
        })

        mockEvaluator.invoke.mockImplementation(async (nodeId: NodeId) => {
          if (nodeId === iterateNode.id) {
            iteratorExpanded = true

            return {
              value: [],
              metadata: { source: 'test', timestamp: Date.now() },
            }
          }

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
        const invokedNodeIds = mockEvaluator.invoke.mock.calls.map(([nodeId]) => nodeId)

        expect(invokedNodeIds).toContain(iterateNode.id)
        expect(invokedNodeIds).toContain(dynamicAnswerNode.id)
        expect(invokedNodeIds.indexOf(iterateNode.id)).toBeLessThan(invokedNodeIds.indexOf(dynamicAnswerNode.id))
      })

      it('should expose journey reachability to submit transitions after answers are prepared', async () => {
        // Arrange
        const submitTransition = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
        const step = createStepWithTransitions({ code: 'test-step', onSubmission: [submitTransition] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        mockCompiledForm.reachabilityPlan = {
          entries: [
            {
              stepId: step.id,
              path: 'step-1',
              code: 'test-step',
              isEntryPoint: true,
              forwardOutcomeIds: [],
              hasValidation: false,
              cleardownFieldCodes: [],
              fieldIteratorRootIds: [],
              validationIterateNodeIds: [],
              validationBlockIds: [],
              domainValidationNodeIds: [],
            },
          ],
        }

        mockEvaluator.invoke.mockImplementation(async (nodeId: NodeId, context?: ThunkEvaluationContext) => {
          if (nodeId === submitTransition.id) {
            expect(context?.global.reachability).toEqual({
              reachableSteps: [{ path: '/journey/step-1', code: 'test-step' }],
              unreachableSteps: [],
            })

            const submitResult: SubmitTransitionResult = {
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

    describe('action transitions', () => {
      it('should run action transitions after access passes', async () => {
        // Arrange
        const actionTransition = ASTTestFactory.transition(TransitionType.ACTION).build() as ActionTransitionASTNode
        const step = createStepWithTransitions({ onAction: [actionTransition] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const actionResult: ActionTransitionResult = { executed: true }
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
        expect(mockEvaluator.invoke).toHaveBeenCalledWith(actionTransition.id, mockContext)
      })

      it('should stop at first executing action (first-match semantics)', async () => {
        // Arrange
        const action1 = ASTTestFactory.transition(TransitionType.ACTION).build() as ActionTransitionASTNode
        const action2 = ASTTestFactory.transition(TransitionType.ACTION).build() as ActionTransitionASTNode
        const step = createStepWithTransitions({ onAction: [action1, action2] })
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

    describe('submit transitions', () => {
      it('should run StepValidityAnalyzer before submit transitions when a submit transition requires validation', async () => {
        const submitTransition = ASTTestFactory.transition(TransitionType.SUBMIT)
          .withProperty('validate', true)
          .build() as SubmitTransitionASTNode
        const step = createStepWithTransitions({ onSubmission: [submitTransition] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const submitResult: SubmitTransitionResult = {
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

      it('should run submit transitions after actions', async () => {
        // Arrange
        const submitTransition = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
        const step = createStepWithTransitions({ onSubmission: [submitTransition] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const submitResult: SubmitTransitionResult = { executed: true, validated: false, outcome: 'continue' }
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
        expect(mockEvaluator.invoke).toHaveBeenCalledWith(submitTransition.id, mockContext)
      })

      it('should redirect when submit has next path', async () => {
        // Arrange
        const submitTransition = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
        const step = createStepWithTransitions({ onSubmission: [submitTransition] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const submitResult: SubmitTransitionResult = {
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
        const submitTransition = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
        const step = createStepWithTransitions({ onSubmission: [submitTransition] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const submitResult: SubmitTransitionResult = {
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
        const submitTransition = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
        const step = createStepWithTransitions({ onSubmission: [submitTransition] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const submitResult: SubmitTransitionResult = {
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
        const submitTransition = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
        const step = createStepWithTransitions({ onSubmission: [submitTransition] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const submitResult: SubmitTransitionResult = {
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

      it('should render without validation flags when no submit transitions execute', async () => {
        // Arrange
        const submitTransition = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
        const step = createStepWithTransitions({ onSubmission: [submitTransition] })
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const submitResult: SubmitTransitionResult = { executed: false, validated: false, outcome: 'continue' }
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
      const accessTransition = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const step = createStepWithTransitions({ onAccess: [accessTransition] })
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
      const accessTransition = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const step = createStepWithTransitions({ onAccess: [accessTransition] })
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
      const accessTransition = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const step = createStepWithTransitions({ onAccess: [accessTransition] })
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
      const step = createStepWithTransitions({})
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

      ;(mockDependencies.frameworkAdapter.toStepRequest as jest.Mock).mockReturnValue(customRequest)

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
    it('should invoke access transitions which execute effects internally', async () => {
      // Arrange
      const accessTransition = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const step = createStepWithTransitions({ onAccess: [accessTransition] })
      mockCompiledForm = createCompiledForm(step)

      setupAncestorChain([step])

      const accessResult: AccessTransitionResult = { executed: true, outcome: 'continue' }

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

      // Assert - Access transition was invoked (effects execute internally)
      expect(mockEvaluator.invoke).toHaveBeenCalledWith(accessTransition.id, mockContext)
    })

    it('should invoke action transitions which execute effects internally', async () => {
      // Arrange
      const actionTransition = ASTTestFactory.transition(TransitionType.ACTION).build() as ActionTransitionASTNode
      const step = createStepWithTransitions({ onAction: [actionTransition] })
      mockCompiledForm = createCompiledForm(step)

      setupAncestorChain([step])

      const actionResult: ActionTransitionResult = { executed: true }

      mockEvaluator.invoke.mockResolvedValue({
        value: actionResult,
        metadata: { source: 'test', timestamp: Date.now() },
      })
      ;(mockDependencies.frameworkAdapter.toStepRequest as jest.Mock).mockReturnValue(
        createMockRequest({ method: 'POST' }),
      )

      const controller = new StepController(
        mockCompiledForm,
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.post(mockReq, mockRes)

      // Assert - Action transition was invoked (effects execute internally)
      expect(mockEvaluator.invoke).toHaveBeenCalledWith(actionTransition.id, mockContext)
    })

    it('should invoke submit transitions which execute effects internally', async () => {
      // Arrange
      const submitTransition = ASTTestFactory.transition(TransitionType.SUBMIT).build() as SubmitTransitionASTNode
      const step = createStepWithTransitions({ onSubmission: [submitTransition] })
      mockCompiledForm = createCompiledForm(step)

      setupAncestorChain([step])

      const submitResult: SubmitTransitionResult = {
        executed: true,
        validated: false,
        outcome: 'redirect',
        redirect: 'next',
      }

      mockEvaluator.invoke.mockResolvedValue({
        value: submitResult,
        metadata: { source: 'test', timestamp: Date.now() },
      })
      ;(mockDependencies.frameworkAdapter.toStepRequest as jest.Mock).mockReturnValue(
        createMockRequest({ method: 'POST' }),
      )

      const controller = new StepController(
        mockCompiledForm,
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
        mockRouteTemplateCatalog,
      )

      // Act
      await controller.post(mockReq, mockRes)

      // Assert - Submit transition was invoked (effects execute internally)
      expect(mockEvaluator.invoke).toHaveBeenCalledWith(submitTransition.id, mockContext)
    })
  })

  describe('edge cases', () => {
    it('should handle step with no transitions', async () => {
      // Arrange
      const step = createStepWithTransitions({})
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

    it('should handle multiple access transitions', async () => {
      // Arrange
      const access1 = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const access2 = ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode
      const step = createStepWithTransitions({ onAccess: [access1, access2] })
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

      // Assert - Both access transitions should be invoked
      expect(mockEvaluator.invoke).toHaveBeenCalledWith(access1.id, mockContext)
      expect(mockEvaluator.invoke).toHaveBeenCalledWith(access2.id, mockContext)
    })

    it('should handle deeply nested journey hierarchy', async () => {
      // Arrange
      const outerJourney = createJourneyWithTransitions({
        onAccess: [ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode],
      })
      const innerJourney = createJourneyWithTransitions({
        onAccess: [ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode],
      })
      const step = createStepWithTransitions({
        onAccess: [ASTTestFactory.transition(TransitionType.ACCESS).build() as AccessTransitionASTNode],
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

      // Assert - All three access transitions should be invoked
      expect(mockEvaluator.invoke).toHaveBeenCalledTimes(3)
    })
  })

})
