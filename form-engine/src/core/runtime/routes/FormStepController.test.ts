import { ASTNodeType } from '@form-engine/core/types/enums'
import { TransitionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import {
  AccessTransitionASTNode,
  ActionTransitionASTNode,
  SubmitTransitionASTNode,
} from '@form-engine/core/types/expressions.type'
import { FormInstanceDependencies, NodeId, AstNodeId } from '@form-engine/core/types/engine.type'
import { AccessTransitionResult } from '@form-engine/core/nodes/transitions/access/AccessHandler'
import { SubmitTransitionResult } from '@form-engine/core/nodes/transitions/submit/SubmitHandler'
import { ActionTransitionResult } from '@form-engine/core/nodes/transitions/action/ActionHandler'
import { CompiledForm } from '@form-engine/core/compilation/FormCompilationFactory'
import { JourneyMetadata } from '@form-engine/core/runtime/rendering/types'
import ThunkEvaluator, { EvaluationResult } from '@form-engine/core/compilation/thunks/ThunkEvaluator'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import FormStepController from './FormStepController'
import { StepRequest } from './types'

jest.mock('@form-engine/core/compilation/thunks/ThunkEvaluator')

const mockRenderContextFactoryBuild = jest.fn().mockReturnValue({ step: {}, blocks: [], ancestors: [] })
jest.mock('@form-engine/core/runtime/rendering/RenderContextFactory', () => {
  return {
    __esModule: true,
    default: {
      build: (...args: unknown[]) => mockRenderContextFactoryBuild(...args),
    },
  }
})

describe('FormStepController', () => {
  let mockCompiledForm: CompiledForm[number]
  let mockDependencies: jest.Mocked<FormInstanceDependencies>
  let mockNavigationMetadata: JourneyMetadata[]
  let mockCurrentStepPath: string
  let mockRequest: StepRequest
  let mockReq: unknown
  let mockRes: unknown
  let mockEvaluator: jest.Mocked<ThunkEvaluator>
  let mockContext: jest.Mocked<ThunkEvaluationContext>

  beforeEach(() => {
    ASTTestFactory.resetIds()
    mockRenderContextFactoryBuild.mockClear()

    mockCurrentStepPath = '/journey/step-1'
    mockNavigationMetadata = []

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
        getBaseUrl: jest.fn().mockReturnValue('/forms/journey'),
      },
      componentRegistry: {} as any,
      functionRegistry: {} as any,
    } as unknown as jest.Mocked<FormInstanceDependencies>

    mockRequest = {
      method: 'GET',
      post: {},
      query: {},
      params: {},
      url: 'http://localhost/journey/step-1',
    }

    mockReq = {}
    mockRes = {}

    mockContext = {
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
      },
    } as unknown as jest.Mocked<ThunkEvaluationContext>

    mockEvaluator = {
      createContext: jest.fn().mockReturnValue(mockContext),
      invoke: jest.fn(),
      evaluate: jest.fn(),
    } as unknown as jest.Mocked<ThunkEvaluator>
    ;(ThunkEvaluator.withRuntimeOverlay as jest.Mock).mockReturnValue(mockEvaluator)
  })

  function createCompiledForm(stepNode: StepASTNode): CompiledForm[number] {
    return {
      artefact: {
        nodeRegistry: {
          get: jest.fn(),
        },
        metadataRegistry: {
          get: jest.fn(),
        },
      } as any,
      currentStepId: stepNode.id,
    }
  }

  function createStepWithTransitions(options: {
    onAccess?: AccessTransitionASTNode[]
    onAction?: ActionTransitionASTNode[]
    onSubmission?: SubmitTransitionASTNode[]
  }): StepASTNode {
    return {
      type: ASTNodeType.STEP,
      id: ASTTestFactory.getId(),
      properties: {
        path: '/step-1',
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

        mockEvaluator.evaluate.mockResolvedValue({
          context: mockContext,
          journey: { value: {}, metadata: { source: 'test', timestamp: Date.now() } },
        })

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act
        await controller.get(mockRequest, mockReq, mockRes)

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

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act & Assert
        await expect(controller.get(mockRequest, mockReq, mockRes)).rejects.toThrow('Access denied')
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

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act
        await controller.get(mockRequest, mockReq, mockRes)

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

          return { value: { executed: true, outcome: 'continue' }, metadata: { source: 'test', timestamp: Date.now() } }
        })

        mockEvaluator.evaluate.mockResolvedValue({
          context: mockContext,
          journey: { value: {}, metadata: { source: 'test', timestamp: Date.now() } },
        })

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act
        await controller.get(mockRequest, mockReq, mockRes)

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

          return { value: { executed: true, outcome: 'continue' }, metadata: { source: 'test', timestamp: Date.now() } }
        })

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act
        await controller.get(mockRequest, mockReq, mockRes)

        // Assert - Step access should never be called
        expect(mockEvaluator.invoke).not.toHaveBeenCalledWith(stepAccessTransition.id, expect.anything())
        expect(mockDependencies.frameworkAdapter.redirect).toHaveBeenCalled()
      })
    })

    describe('rendering', () => {
      it('should evaluate AST and render after passing all access checks', async () => {
        // Arrange
        const step = createStepWithTransitions({})
        mockCompiledForm = createCompiledForm(step)

        setupAncestorChain([step])

        const evaluationResult: EvaluationResult = {
          context: mockContext,
          journey: { value: { type: ASTNodeType.JOURNEY }, metadata: { source: 'test', timestamp: Date.now() } },
        }
        mockEvaluator.evaluate.mockResolvedValue(evaluationResult)

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act
        await controller.get(mockRequest, mockReq, mockRes)

        // Assert
        expect(mockEvaluator.evaluate).toHaveBeenCalledWith(mockContext)
        expect(mockDependencies.frameworkAdapter.render).toHaveBeenCalled()
      })
    })
  })

  describe('post()', () => {
    beforeEach(() => {
      mockRequest.method = 'POST'
      mockRequest.post = { fieldName: 'value' }
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

        mockEvaluator.evaluate.mockResolvedValue({
          context: mockContext,
          journey: { value: {}, metadata: { source: 'test', timestamp: Date.now() } },
        })

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act
        await controller.post(mockRequest, mockReq, mockRes)

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

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act & Assert
        await expect(controller.post(mockRequest, mockReq, mockRes)).rejects.toThrow('Access denied')
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

        mockEvaluator.evaluate.mockResolvedValue({
          context: mockContext,
          journey: { value: {}, metadata: { source: 'test', timestamp: Date.now() } },
        })

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act
        await controller.post(mockRequest, mockReq, mockRes)

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

        mockEvaluator.evaluate.mockResolvedValue({
          context: mockContext,
          journey: { value: {}, metadata: { source: 'test', timestamp: Date.now() } },
        })

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act
        await controller.post(mockRequest, mockReq, mockRes)

        // Assert - Only first action should be invoked
        expect(mockEvaluator.invoke).toHaveBeenCalledWith(action1.id, mockContext)
        expect(mockEvaluator.invoke).not.toHaveBeenCalledWith(action2.id, expect.anything())
      })
    })

    describe('submit transitions', () => {
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

        mockEvaluator.evaluate.mockResolvedValue({
          context: mockContext,
          journey: { value: {}, metadata: { source: 'test', timestamp: Date.now() } },
        })

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act
        await controller.post(mockRequest, mockReq, mockRes)

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

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act
        await controller.post(mockRequest, mockReq, mockRes)

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

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act
        await controller.post(mockRequest, mockReq, mockRes)

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

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act
        await controller.post(mockRequest, mockReq, mockRes)

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

        mockEvaluator.evaluate.mockResolvedValue({
          context: mockContext,
          journey: { value: {}, metadata: { source: 'test', timestamp: Date.now() } },
        })

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act
        await controller.post(mockRequest, mockReq, mockRes)

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

        mockEvaluator.evaluate.mockResolvedValue({
          context: mockContext,
          journey: { value: {}, metadata: { source: 'test', timestamp: Date.now() } },
        })

        const controller = new FormStepController(
          mockCompiledForm,
          mockDependencies,
          mockNavigationMetadata,
          mockCurrentStepPath,
        )

        // Act
        await controller.post(mockRequest, mockReq, mockRes)

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

      const controller = new FormStepController(
        mockCompiledForm,
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
      )

      // Act
      await controller.get(mockRequest, mockReq, mockRes)

      // Assert
      expect(mockDependencies.frameworkAdapter.getBaseUrl).toHaveBeenCalledWith(mockReq)
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

      const controller = new FormStepController(
        mockCompiledForm,
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
      )

      // Act
      await controller.get(mockRequest, mockReq, mockRes)

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

      const controller = new FormStepController(
        mockCompiledForm,
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
      )

      // Act
      await controller.get(mockRequest, mockReq, mockRes)

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

      mockRequest = {
        method: 'POST',
        post: { field1: 'value1' },
        query: { param1: 'value1' },
        params: { id: '123' },
        url: 'http://localhost/journey/step-1',
        session: { userId: 'user-1' },
        state: { key: 'value' },
      }

      mockEvaluator.evaluate.mockResolvedValue({
        context: mockContext,
        journey: { value: {}, metadata: { source: 'test', timestamp: Date.now() } },
      })

      const controller = new FormStepController(
        mockCompiledForm,
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
      )

      // Act
      await controller.post(mockRequest, mockReq, mockRes)

      // Assert
      expect(mockEvaluator.createContext).toHaveBeenCalledWith({
        method: 'POST',
        post: { field1: 'value1' },
        query: { param1: 'value1' },
        params: { id: '123' },
        url: 'http://localhost/journey/step-1',
        session: { userId: 'user-1' },
        state: { key: 'value' },
      })
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

      mockEvaluator.evaluate.mockResolvedValue({
        context: mockContext,
        journey: { value: {}, metadata: { source: 'test', timestamp: Date.now() } },
      })

      const controller = new FormStepController(
        mockCompiledForm,
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
      )

      // Act
      await controller.get(mockRequest, mockReq, mockRes)

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

      mockEvaluator.evaluate.mockResolvedValue({
        context: mockContext,
        journey: { value: {}, metadata: { source: 'test', timestamp: Date.now() } },
      })

      const controller = new FormStepController(
        mockCompiledForm,
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
      )
      mockRequest.method = 'POST'

      // Act
      await controller.post(mockRequest, mockReq, mockRes)

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

      const controller = new FormStepController(
        mockCompiledForm,
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
      )
      mockRequest.method = 'POST'

      // Act
      await controller.post(mockRequest, mockReq, mockRes)

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

      mockEvaluator.evaluate.mockResolvedValue({
        context: mockContext,
        journey: { value: {}, metadata: { source: 'test', timestamp: Date.now() } },
      })

      const controller = new FormStepController(
        mockCompiledForm,
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
      )

      // Act
      await controller.get(mockRequest, mockReq, mockRes)

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

      mockEvaluator.evaluate.mockResolvedValue({
        context: mockContext,
        journey: { value: {}, metadata: { source: 'test', timestamp: Date.now() } },
      })

      const controller = new FormStepController(
        mockCompiledForm,
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
      )

      // Act
      await controller.get(mockRequest, mockReq, mockRes)

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

      mockEvaluator.evaluate.mockResolvedValue({
        context: mockContext,
        journey: { value: {}, metadata: { source: 'test', timestamp: Date.now() } },
      })

      const controller = new FormStepController(
        mockCompiledForm,
        mockDependencies,
        mockNavigationMetadata,
        mockCurrentStepPath,
      )

      // Act
      await controller.get(mockRequest, mockReq, mockRes)

      // Assert - All three access transitions should be invoked
      expect(mockEvaluator.invoke).toHaveBeenCalledTimes(3)
    })
  })
})
