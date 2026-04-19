import { JourneyInstanceDependencies, NodeId, CompileAstNodeId } from '../../types/engine.type'
import { ForgeOptions } from '../../Forge'
import { FrameworkAdapter, FrameworkAdapterBuilder } from '../../../framework'
import { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import { ASTNodeType } from '../../types/enums'
import { StructureType } from '../../../authoring'
import type { JourneyDefinition } from '../../../authoring'
import DuplicateRouteError from '../../errors/DuplicateRouteError'
import JourneyInstance from '../../JourneyInstance'
import StepController from './StepController'
import JourneyController from './JourneyController'
import { JourneyRuntimePlan, StepRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import ForgeRouter from './ForgeRouter'

vi.mock('./StepController')
vi.mock('./JourneyController')

describe('ForgeRouter', () => {
  let router: ForgeRouter<unknown>
  let mockFrameworkAdapter: Mocked<FrameworkAdapter<unknown, unknown, unknown>>
  let mockFrameworkAdapterBuilder: Mocked<FrameworkAdapterBuilder<unknown, unknown, unknown>>
  let mockLogger: Mocked<Console>
  let mockDependencies: JourneyInstanceDependencies
  let mockOptions: ForgeOptions
  let mockMainRouter: unknown
  let mockControllerGet: Mock
  let mockControllerPost: Mock
  let mockJourneyControllerGet: Mock

  beforeEach(() => {
    vi.clearAllMocks()
    mockControllerGet = vi.fn().mockResolvedValue(undefined)
    mockControllerPost = vi.fn().mockResolvedValue(undefined)
    mockJourneyControllerGet = vi.fn().mockResolvedValue(undefined)
    ;(StepController as unknown as MockedClass<typeof StepController>).mockImplementation(
      function mockStepControllerCtor() {
        return {
          get: mockControllerGet,
          post: mockControllerPost,
        } as unknown as StepController<unknown, unknown>
      },
    )
    ;(JourneyController as unknown as MockedClass<typeof JourneyController>).mockImplementation(
      function mockJourneyControllerCtor() {
        return {
          get: mockJourneyControllerGet,
        } as unknown as JourneyController<unknown, unknown>
      },
    )

    mockMainRouter = { _type: 'main-router' }

    mockFrameworkAdapter = {
      createRouter: vi.fn().mockReturnValue(mockMainRouter),
      mountRouter: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      toStepRequest: vi.fn(),
      redirect: vi.fn(),
      forwardError: vi.fn(),
      render: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<FrameworkAdapter<unknown, unknown, unknown>>

    mockFrameworkAdapterBuilder = {
      build: vi.fn().mockReturnValue(mockFrameworkAdapter),
    } as unknown as Mocked<FrameworkAdapterBuilder<unknown, unknown, unknown>>

    mockLogger = {
      log: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as unknown as Mocked<Console>

    mockDependencies = {
      frameworkAdapter: mockFrameworkAdapter,
      logger: mockLogger,
      componentRegistry: {} as any,
      functionRegistry: {} as any,
    }

    mockOptions = {
      frameworkAdapter: mockFrameworkAdapterBuilder,
    }

    router = new ForgeRouter(mockDependencies, mockOptions)
  })

  function createMockStepNode(id: CompileAstNodeId, path: string): StepASTNode {
    return {
      type: ASTNodeType.STEP,
      id,
      properties: {
        path,
        title: `Step ${path}`,
      },
    }
  }

  function createMockJourneyNode(
    id: CompileAstNodeId,
    path: string,
    code: string,
    steps?: StepASTNode[],
  ): JourneyASTNode {
    return {
      type: ASTNodeType.JOURNEY,
      id,
      properties: {
        path,
        code,
        title: `Journey ${code}`,
        steps,
      },
    }
  }

  function createMockArtefact(stepNode: StepASTNode, journeyNodes: JourneyASTNode[], parentChain: NodeId[]) {
    const nodeRegistry = {
      get: vi.fn((nodeId: NodeId) => {
        if (nodeId === stepNode.id) {
          return stepNode
        }

        return journeyNodes.find(j => j.id === nodeId)
      }),
    }

    const metadataRegistry = {
      get: vi.fn((nodeId: NodeId, key: string) => {
        if (key !== 'attachedToParentNode') {
          return undefined
        }

        const currentIndex = parentChain.indexOf(nodeId)

        if (currentIndex > 0) {
          return parentChain[currentIndex - 1]
        }

        return undefined
      }),
    }

    return { nodeRegistry, metadataRegistry, journeyNodes }
  }

  function createMockJourneyInstance(
    compiledForm: Array<{ artefact: any; currentStepId: NodeId; runtimePlan?: StepRuntimePlan }>,
    config: JourneyDefinition,
  ): Mocked<JourneyInstance> {
    const compiledSteps = compiledForm.map(compiled => {
      if (compiled.runtimePlan !== undefined) {
        return compiled
      }

      return {
        ...compiled,
        reachabilityPlan: { entries: [], resumeAlways: false },
        runtimePlan: {
          stepId: compiled.currentStepId,
          accessAncestorIds: [compiled.currentStepId],
          actionHookIds: [],
          submitHookIds: [],
          fieldIteratorRootIds: [],
          validationIterateNodeIds: [],
          validationBlockIds: [],
          domainValidationNodeIds: [],
          renderAncestorIds: [],
          renderStepId: compiled.currentStepId,
          hasValidatingSubmitHook: false,
          hasDomainValidation: false,
        },
      }
    })

    const byStepId = new Map(compiledSteps.map(compiled => [compiled.currentStepId, compiled]))
    const stepIndex = new Map(
      compiledSteps.map(compiled => [
        compiled.currentStepId,
        compiled.artefact.nodeRegistry.get(compiled.currentStepId),
      ]),
    )

    const sharedArtefact = {
      nodeRegistry: {
        get: vi.fn((nodeId: NodeId) => {
          for (const compiled of compiledSteps) {
            const node = compiled.artefact.nodeRegistry.get(nodeId)

            if (node !== undefined) {
              return node
            }
          }

          return undefined
        }),
      },
      metadataRegistry: {
        get: vi.fn((nodeId: NodeId, key: string) => {
          for (const compiled of compiledSteps) {
            const metadata = compiled.artefact.metadataRegistry.get(nodeId, key)

            if (metadata !== undefined) {
              return metadata
            }
          }

          return undefined
        }),
      },
    }

    const journeyRuntimePlanMock: JourneyRuntimePlan = {
      journeyId: 'compile_ast:journey' as NodeId,
      path: '/mock',
      accessAncestorIds: [],
      fieldIteratorRootIds: [],
      reachabilityPlan: { entries: [], resumeAlways: false },
    }

    return {
      getCompiledForm: vi.fn().mockReturnValue(compiledSteps),
      getCompiledStep: vi.fn().mockImplementation((stepId: NodeId) => {
        const compiledStep = byStepId.get(stepId)

        if (!compiledStep) {
          throw new Error(`Unable to resolve compiled step for ${stepId}`)
        }

        return compiledStep
      }),
      getStepIndex: vi.fn().mockImplementation(() => new Map(stepIndex)),
      getJourneyIndex: vi.fn().mockImplementation(() => {
        const allJourneyNodes = compiledSteps.flatMap(c => c.artefact.journeyNodes ?? [])
        const uniqueJourneys = new Map(allJourneyNodes.map((j: JourneyASTNode) => [j.id, j]))

        return new Map(uniqueJourneys)
      }),
      getJourneyRuntimePlan: vi.fn().mockReturnValue(journeyRuntimePlanMock),
      getSharedCompilationArtefact: vi.fn().mockReturnValue(sharedArtefact),
      getConfiguration: vi.fn().mockReturnValue(config),
      getJourneyCode: vi.fn().mockReturnValue(config.code),
      getJourneyTitle: vi.fn().mockReturnValue(config.title),
    } as unknown as Mocked<JourneyInstance>
  }

  describe('constructor', () => {
    it('should create main router via framework adapter', () => {
      // Assert
      expect(mockFrameworkAdapter.createRouter).toHaveBeenCalledTimes(1)
    })
  })

  describe('getRouter()', () => {
    it('should return the main router', () => {
      // Act
      const result = router.getRouter()

      // Assert
      expect(result).toBe(mockMainRouter)
    })
  })

  describe('getRegisteredRoutes()', () => {
    it('should return empty array initially', () => {
      // Act
      const routes = router.getRegisteredRoutes()

      // Assert
      expect(routes).toEqual([])
    })
  })

  describe('getNavigationMetadata()', () => {
    it('should return empty array initially', () => {
      // Act
      const metadata = router.getNavigationMetadata()

      // Assert
      expect(metadata).toEqual([])
    })
  })

  describe('mount()', () => {
    it('should mount routes without eagerly compiling steps', () => {
      // Arrange
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode = createMockStepNode('compile_ast:2', '/step-one')
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [{ type: StructureType.STEP, path: '/step-one', title: 'Step One' }],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mount(journeyInstance)

      // Assert
      expect(journeyInstance.getStepIndex).toHaveBeenCalledTimes(1)
      expect(journeyInstance.getSharedCompilationArtefact).toHaveBeenCalledTimes(1)
      expect(journeyInstance.getCompiledForm).not.toHaveBeenCalled()
    })

    it('should mount GET and POST routes for each step', () => {
      // Arrange
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode = createMockStepNode('compile_ast:2', '/step-one')
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [{ type: StructureType.STEP, path: '/step-one', title: 'Step One' }],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mount(journeyInstance)

      // Assert
      expect(mockFrameworkAdapter.get).toHaveBeenCalledWith(expect.anything(), '/step-one', expect.any(Function))
      expect(mockFrameworkAdapter.post).toHaveBeenCalledWith(expect.anything(), '/step-one', expect.any(Function))
    })

    it('should lazily create the controller on first request and reuse it', async () => {
      // Arrange
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode = createMockStepNode('compile_ast:2', '/step-one')
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])
      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [{ type: StructureType.STEP, path: '/step-one', title: 'Step One' }],
      }
      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mount(journeyInstance)

      // Assert - no controller or step compilation at mount time
      expect(StepController).not.toHaveBeenCalled()
      expect(journeyInstance.getCompiledStep).not.toHaveBeenCalled()

      const getHandler = mockFrameworkAdapter.get.mock.calls[0][2] as (req: unknown, res: unknown) => Promise<void>

      await getHandler({}, {})

      // Assert - first request triggers lazy compilation and controller creation
      expect(journeyInstance.getCompiledStep).toHaveBeenCalledTimes(1)
      expect(journeyInstance.getCompiledStep).toHaveBeenCalledWith(stepNode.id)
      expect(StepController).toHaveBeenCalledTimes(1)

      await getHandler({}, {})

      // Assert - second request reuses the controller
      expect(StepController).toHaveBeenCalledTimes(1)
      expect(mockControllerGet).toHaveBeenCalledTimes(2)
    })

    it('should register routes with correct full paths', () => {
      // Arrange
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode = createMockStepNode('compile_ast:2', '/step-one')
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [{ type: StructureType.STEP, path: '/step-one', title: 'Step One' }],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mount(journeyInstance)

      // Assert
      const routes = router.getRegisteredRoutes()
      expect(routes).toContainEqual({ method: 'GET', path: '/journey/step-one' })
      expect(routes).toContainEqual({ method: 'POST', path: '/journey/step-one' })
    })

    it('should store navigation metadata for the journey', () => {
      // Arrange
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode = createMockStepNode('compile_ast:2', '/step-one')
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        description: 'A test journey',
        steps: [{ type: StructureType.STEP, path: '/step-one', title: 'Step One' }],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mount(journeyInstance)

      // Assert
      const metadata = router.getNavigationMetadata()
      expect(metadata).toHaveLength(1)
      expect(metadata[0]).toEqual({
        title: 'Test Journey',
        description: 'A test journey',
        path: '/journey',
        children: [{ title: 'Step One', path: '/journey/step-one' }],
      })
    })

    it('should throw DuplicateRouteError when same path is registered twice', () => {
      // Arrange
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode1 = createMockStepNode('compile_ast:2', '/same-path')
      const stepNode2 = createMockStepNode('compile_ast:3', '/same-path')
      const artefact1 = createMockArtefact(stepNode1, [journeyNode], [journeyNode.id, stepNode1.id])
      const artefact2 = createMockArtefact(stepNode2, [journeyNode], [journeyNode.id, stepNode2.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          { type: StructureType.STEP, path: '/same-path', title: 'Step One' },
          { type: StructureType.STEP, path: '/same-path', title: 'Step Two' },
        ],
      }

      const journeyInstance = createMockJourneyInstance(
        [
          { artefact: artefact1, currentStepId: stepNode1.id },
          { artefact: artefact2, currentStepId: stepNode2.id },
        ],
        config,
      )

      // Act & Assert
      expect(() => router.mount(journeyInstance)).toThrow(DuplicateRouteError)
    })
  })

  describe('nested journey routing', () => {
    it('should create nested routers for child journeys', () => {
      // Arrange
      const parentJourney = createMockJourneyNode('compile_ast:1', '/parent', 'parent-journey')
      const childJourney = createMockJourneyNode('compile_ast:2', '/child', 'child-journey')
      const stepNode = createMockStepNode('compile_ast:3', '/step')
      const artefact = createMockArtefact(
        stepNode,
        [parentJourney, childJourney],
        [parentJourney.id, childJourney.id, stepNode.id],
      )

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/parent',
        code: 'parent-journey',
        title: 'Parent Journey',
        children: [
          {
            type: StructureType.JOURNEY,
            path: '/child',
            code: 'child-journey',
            title: 'Child Journey',
            steps: [{ type: StructureType.STEP, path: '/step', title: 'Nested Step' }],
          },
        ],
      }

      const childRouter = { _type: 'child-router' }
      mockFrameworkAdapter.createRouter.mockReturnValueOnce(mockMainRouter).mockReturnValueOnce(childRouter)

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mount(journeyInstance)

      // Assert
      expect(mockFrameworkAdapter.createRouter).toHaveBeenCalledTimes(3) // main + parent + child
      expect(mockFrameworkAdapter.mountRouter).toHaveBeenCalledTimes(2)
    })

    it('should reuse existing journey routers for multiple steps', () => {
      // Arrange
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode1 = createMockStepNode('compile_ast:2', '/step-one')
      const stepNode2 = createMockStepNode('compile_ast:3', '/step-two')
      const artefact1 = createMockArtefact(stepNode1, [journeyNode], [journeyNode.id, stepNode1.id])
      const artefact2 = createMockArtefact(stepNode2, [journeyNode], [journeyNode.id, stepNode2.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          { type: StructureType.STEP, path: '/step-one', title: 'Step One' },
          { type: StructureType.STEP, path: '/step-two', title: 'Step Two' },
        ],
      }

      const journeyRouter = { _type: 'journey-router' }
      mockFrameworkAdapter.createRouter.mockReturnValueOnce(mockMainRouter).mockReturnValueOnce(journeyRouter)

      const journeyInstance = createMockJourneyInstance(
        [
          { artefact: artefact1, currentStepId: stepNode1.id },
          { artefact: artefact2, currentStepId: stepNode2.id },
        ],
        config,
      )

      // Act
      router.mount(journeyInstance)

      // Assert
      // Should create main router + one journey router (reused for both steps)
      expect(mockFrameworkAdapter.createRouter).toHaveBeenCalledTimes(2)
      expect(mockFrameworkAdapter.mountRouter).toHaveBeenCalledTimes(1)
    })

    it('should register routes with full nested path', () => {
      // Arrange
      const parentJourney = createMockJourneyNode('compile_ast:1', '/parent', 'parent-journey')
      const childJourney = createMockJourneyNode('compile_ast:2', '/child', 'child-journey')
      const stepNode = createMockStepNode('compile_ast:3', '/step')
      const artefact = createMockArtefact(
        stepNode,
        [parentJourney, childJourney],
        [parentJourney.id, childJourney.id, stepNode.id],
      )

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/parent',
        code: 'parent-journey',
        title: 'Parent Journey',
        children: [
          {
            type: StructureType.JOURNEY,
            path: '/child',
            code: 'child-journey',
            title: 'Child Journey',
            steps: [{ type: StructureType.STEP, path: '/step', title: 'Nested Step' }],
          },
        ],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mount(journeyInstance)

      // Assert
      const routes = router.getRegisteredRoutes()
      expect(routes).toContainEqual({ method: 'GET', path: '/parent/child/step' })
      expect(routes).toContainEqual({ method: 'POST', path: '/parent/child/step' })
    })
  })

  describe('navigation metadata extraction', () => {
    it('should extract metadata for nested journeys', () => {
      // Arrange
      const parentJourney = createMockJourneyNode('compile_ast:1', '/parent', 'parent-journey')
      const childJourney = createMockJourneyNode('compile_ast:2', '/child', 'child-journey')
      const stepNode = createMockStepNode('compile_ast:3', '/step')
      const artefact = createMockArtefact(
        stepNode,
        [parentJourney, childJourney],
        [parentJourney.id, childJourney.id, stepNode.id],
      )

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/parent',
        code: 'parent-journey',
        title: 'Parent Journey',
        description: 'Parent description',
        children: [
          {
            type: StructureType.JOURNEY,
            path: '/child',
            code: 'child-journey',
            title: 'Child Journey',
            description: 'Child description',
            steps: [{ type: StructureType.STEP, path: '/step', title: 'Nested Step' }],
          },
        ],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mount(journeyInstance)

      // Assert
      const metadata = router.getNavigationMetadata()
      expect(metadata).toHaveLength(1)
      expect(metadata[0]).toEqual({
        title: 'Parent Journey',
        description: 'Parent description',
        path: '/parent',
        children: [
          {
            title: 'Child Journey',
            description: 'Child description',
            path: '/parent/child',
            children: [{ title: 'Nested Step', path: '/parent/child/step' }],
          },
        ],
      })
    })

    it('should handle multiple steps in navigation metadata', () => {
      // Arrange
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode1 = createMockStepNode('compile_ast:2', '/step-one')
      const stepNode2 = createMockStepNode('compile_ast:3', '/step-two')
      const artefact1 = createMockArtefact(stepNode1, [journeyNode], [journeyNode.id, stepNode1.id])
      const artefact2 = createMockArtefact(stepNode2, [journeyNode], [journeyNode.id, stepNode2.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [
          { type: StructureType.STEP, path: '/step-one', title: 'Step One' },
          { type: StructureType.STEP, path: '/step-two', title: 'Step Two' },
        ],
      }

      const journeyInstance = createMockJourneyInstance(
        [
          { artefact: artefact1, currentStepId: stepNode1.id },
          { artefact: artefact2, currentStepId: stepNode2.id },
        ],
        config,
      )

      // Act
      router.mount(journeyInstance)

      // Assert
      const metadata = router.getNavigationMetadata()
      expect(metadata[0].children).toHaveLength(2)
      expect(metadata[0].children).toEqual([
        { title: 'Step One', path: '/journey/step-one' },
        { title: 'Step Two', path: '/journey/step-two' },
      ])
    })

    it('should handle journey without description', () => {
      // Arrange
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode = createMockStepNode('compile_ast:2', '/step')
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [{ type: StructureType.STEP, path: '/step', title: 'Step' }],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mount(journeyInstance)

      // Assert
      const metadata = router.getNavigationMetadata()
      expect(metadata[0].description).toBeUndefined()
    })

    it('should handle journey with no steps', () => {
      // Arrange
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode = createMockStepNode('compile_ast:2', '/step')
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mount(journeyInstance)

      // Assert
      const metadata = router.getNavigationMetadata()
      expect(metadata[0].children).toEqual([])
    })
  })

  describe('multiple form registration', () => {
    it('should accumulate routes from multiple forms', () => {
      // Arrange - First form
      const journey1 = createMockJourneyNode('compile_ast:1', '/form-one', 'form-one')
      const step1 = createMockStepNode('compile_ast:2', '/start')
      const artefact1 = createMockArtefact(step1, [journey1], [journey1.id, step1.id])

      const config1: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/form-one',
        code: 'form-one',
        title: 'Form One',
        steps: [{ type: StructureType.STEP, path: '/start', title: 'Start' }],
      }

      // Arrange - Second form
      const journey2 = createMockJourneyNode('compile_ast:3', '/form-two', 'form-two')
      const step2 = createMockStepNode('compile_ast:4', '/begin')
      const artefact2 = createMockArtefact(step2, [journey2], [journey2.id, step2.id])

      const config2: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/form-two',
        code: 'form-two',
        title: 'Form Two',
        steps: [{ type: StructureType.STEP, path: '/begin', title: 'Begin' }],
      }

      const journeyInstance1 = createMockJourneyInstance([{ artefact: artefact1, currentStepId: step1.id }], config1)
      const journeyInstance2 = createMockJourneyInstance([{ artefact: artefact2, currentStepId: step2.id }], config2)

      // Act
      router.mount(journeyInstance1)
      router.mount(journeyInstance2)

      // Assert
      const routes = router.getRegisteredRoutes()
      expect(routes).toHaveLength(6)
      expect(routes).toContainEqual({ method: 'GET', path: '/form-one' })
      expect(routes).toContainEqual({ method: 'GET', path: '/form-one/start' })
      expect(routes).toContainEqual({ method: 'POST', path: '/form-one/start' })
      expect(routes).toContainEqual({ method: 'GET', path: '/form-two' })
      expect(routes).toContainEqual({ method: 'GET', path: '/form-two/begin' })
      expect(routes).toContainEqual({ method: 'POST', path: '/form-two/begin' })
    })

    it('should accumulate navigation metadata from multiple forms', () => {
      // Arrange - First form
      const journey1 = createMockJourneyNode('compile_ast:1', '/form-one', 'form-one')
      const step1 = createMockStepNode('compile_ast:2', '/start')
      const artefact1 = createMockArtefact(step1, [journey1], [journey1.id, step1.id])

      const config1: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/form-one',
        code: 'form-one',
        title: 'Form One',
        steps: [{ type: StructureType.STEP, path: '/start', title: 'Start' }],
      }

      // Arrange - Second form
      const journey2 = createMockJourneyNode('compile_ast:3', '/form-two', 'form-two')
      const step2 = createMockStepNode('compile_ast:4', '/begin')
      const artefact2 = createMockArtefact(step2, [journey2], [journey2.id, step2.id])

      const config2: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/form-two',
        code: 'form-two',
        title: 'Form Two',
        steps: [{ type: StructureType.STEP, path: '/begin', title: 'Begin' }],
      }

      const journeyInstance1 = createMockJourneyInstance([{ artefact: artefact1, currentStepId: step1.id }], config1)
      const journeyInstance2 = createMockJourneyInstance([{ artefact: artefact2, currentStepId: step2.id }], config2)

      // Act
      router.mount(journeyInstance1)
      router.mount(journeyInstance2)

      // Assert
      const metadata = router.getNavigationMetadata()
      expect(metadata).toHaveLength(2)
      expect(metadata[0].title).toBe('Form One')
      expect(metadata[1].title).toBe('Form Two')
    })
  })

  describe('journey resume handling', () => {
    it('should register a dynamic GET handler at / when the journey has direct steps', () => {
      // Arrange
      const stepNode = createMockStepNode('compile_ast:2', '/entry')
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey', [stepNode])
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [{ type: StructureType.STEP, path: '/entry', title: 'Entry Step' }],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mount(journeyInstance)

      // Assert
      const rootHandlerCall = mockFrameworkAdapter.get.mock.calls.find(call => call[1] === '/')
      expect(rootHandlerCall).toBeDefined()
      expect(router.getRegisteredRoutes()).toContainEqual({ method: 'GET', path: '/journey' })
    })

    it('should not register a resume handler when a step already claims path "/"', () => {
      // Arrange — a step at '/' owns the journey root, so auto-resume must
      // stand down to avoid an infinite redirect loop.
      const rootStep = createMockStepNode('compile_ast:2', '/')
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey', [rootStep])
      const artefact = createMockArtefact(rootStep, [journeyNode], [journeyNode.id, rootStep.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [{ type: StructureType.STEP, path: '/', title: 'Root Step' }],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: rootStep.id }], config)

      // Act
      router.mount(journeyInstance)

      // Assert — the only GET at '/' on this router comes from the step itself,
      // registered by mountStep; the resume handler must not also register.
      const rootHandlerCalls = mockFrameworkAdapter.get.mock.calls.filter(call => call[1] === '/')
      expect(rootHandlerCalls).toHaveLength(1)
      expect(JourneyController).not.toHaveBeenCalled()
    })

    it('should lazily construct the JourneyController on the first request and reuse it', async () => {
      // Arrange
      const stepNode = createMockStepNode('compile_ast:2', '/entry')
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey', [stepNode])
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [{ type: StructureType.STEP, path: '/entry', title: 'Entry Step' }],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mount(journeyInstance)

      // Assert - no controller construction at mount time
      expect(JourneyController).not.toHaveBeenCalled()

      const rootHandler = mockFrameworkAdapter.get.mock.calls.find(call => call[1] === '/')?.[2] as (
        req: unknown,
        res: unknown,
      ) => Promise<void>

      await rootHandler({}, {})

      // Assert - first request triggers construction and dispatch
      expect(JourneyController).toHaveBeenCalledTimes(1)
      expect(mockJourneyControllerGet).toHaveBeenCalledTimes(1)

      await rootHandler({}, {})

      // Assert - second request reuses the controller
      expect(JourneyController).toHaveBeenCalledTimes(1)
      expect(mockJourneyControllerGet).toHaveBeenCalledTimes(2)
    })

    it('should not register a resume handler for a journey with no direct steps', () => {
      // Arrange
      const parentJourney = createMockJourneyNode('compile_ast:1', '/parent', 'parent-journey')
      const childStep = createMockStepNode('compile_ast:3', '/nested')
      const childJourney = createMockJourneyNode('compile_ast:2', '/child', 'child-journey', [childStep])
      const artefact = createMockArtefact(
        childStep,
        [parentJourney, childJourney],
        [parentJourney.id, childJourney.id, childStep.id],
      )

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/parent',
        code: 'parent-journey',
        title: 'Parent Journey',
        children: [
          {
            type: StructureType.JOURNEY,
            path: '/child',
            code: 'child-journey',
            title: 'Child Journey',
            steps: [{ type: StructureType.STEP, path: '/nested', title: 'Nested Step' }],
          },
        ],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: childStep.id }], config)
      ;(journeyInstance.getJourneyRuntimePlan as Mock).mockImplementation((journeyId: NodeId) => {
        if (journeyId === childJourney.id) {
          return {
            journeyId,
            path: '/child',
            accessAncestorIds: [],
            fieldIteratorRootIds: [],
            reachabilityPlan: { entries: [], resumeAlways: false },
          }
        }

        return undefined
      })

      // Act
      router.mount(journeyInstance)

      // Assert - only one '/' GET (from child journey), parent has no resume handler
      const rootHandlerCalls = mockFrameworkAdapter.get.mock.calls.filter(call => call[1] === '/')
      expect(rootHandlerCalls).toHaveLength(1)
    })

    it('should register separate resume handlers for nested journeys that each have direct steps', () => {
      // Arrange
      const parentStep = createMockStepNode('compile_ast:3', '/parent-entry')
      const parentJourney = createMockJourneyNode('compile_ast:1', '/parent', 'parent-journey', [parentStep])
      const childStep = createMockStepNode('compile_ast:4', '/nested')
      const childJourney = createMockJourneyNode('compile_ast:2', '/child', 'child-journey', [childStep])
      const artefactParent = createMockArtefact(parentStep, [parentJourney], [parentJourney.id, parentStep.id])
      const artefactChild = createMockArtefact(
        childStep,
        [parentJourney, childJourney],
        [parentJourney.id, childJourney.id, childStep.id],
      )

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/parent',
        code: 'parent-journey',
        title: 'Parent Journey',
        steps: [{ type: StructureType.STEP, path: '/parent-entry', title: 'Parent Entry' }],
        children: [
          {
            type: StructureType.JOURNEY,
            path: '/child',
            code: 'child-journey',
            title: 'Child Journey',
            steps: [{ type: StructureType.STEP, path: '/nested', title: 'Nested Step' }],
          },
        ],
      }

      const journeyInstance = createMockJourneyInstance(
        [
          { artefact: artefactParent, currentStepId: parentStep.id },
          { artefact: artefactChild, currentStepId: childStep.id },
        ],
        config,
      )

      // Act
      router.mount(journeyInstance)

      // Assert - two GET '/' registrations (one per journey router)
      const rootHandlerCalls = mockFrameworkAdapter.get.mock.calls.filter(call => call[1] === '/')
      expect(rootHandlerCalls).toHaveLength(2)
    })
  })

  describe('basePath configuration', () => {
    it('should prefix routes with basePath when configured', () => {
      // Arrange
      const optionsWithBasePath: ForgeOptions = {
        ...mockOptions,
        basePath: '/forms',
      }

      const routerWithBasePath = new ForgeRouter(mockDependencies, optionsWithBasePath)

      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode = createMockStepNode('compile_ast:2', '/step-one')
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [{ type: StructureType.STEP, path: '/step-one', title: 'Step One' }],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      routerWithBasePath.mount(journeyInstance)

      // Assert
      const routes = routerWithBasePath.getRegisteredRoutes()
      expect(routes).toContainEqual({ method: 'GET', path: '/forms/journey/step-one' })
      expect(routes).toContainEqual({ method: 'POST', path: '/forms/journey/step-one' })
    })

    it('should include basePath in navigation metadata', () => {
      // Arrange
      const optionsWithBasePath: ForgeOptions = {
        ...mockOptions,
        basePath: '/forms',
      }

      const routerWithBasePath = new ForgeRouter(mockDependencies, optionsWithBasePath)

      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode = createMockStepNode('compile_ast:2', '/step-one')
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [{ type: StructureType.STEP, path: '/step-one', title: 'Step One' }],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      routerWithBasePath.mount(journeyInstance)

      // Assert
      const metadata = routerWithBasePath.getNavigationMetadata()
      expect(metadata[0].path).toBe('/forms/journey')
      expect(metadata[0].children[0]).toEqual({ title: 'Step One', path: '/forms/journey/step-one' })
    })

    it('should register the journey resume handler under basePath', () => {
      // Arrange
      const optionsWithBasePath: ForgeOptions = {
        ...mockOptions,
        basePath: '/forms',
      }

      const routerWithBasePath = new ForgeRouter(mockDependencies, optionsWithBasePath)

      const stepNode = createMockStepNode('compile_ast:2', '/first-step')
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey', [stepNode])
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [{ type: StructureType.STEP, path: '/first-step', title: 'First Step' }],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      routerWithBasePath.mount(journeyInstance)

      // Assert
      expect(routerWithBasePath.getRegisteredRoutes()).toContainEqual({ method: 'GET', path: '/forms/journey' })
    })

    it('should mount first journey router at basePath + journeyPath', () => {
      // Arrange
      const optionsWithBasePath: ForgeOptions = {
        ...mockOptions,
        basePath: '/forms',
      }

      const routerWithBasePath = new ForgeRouter(mockDependencies, optionsWithBasePath)

      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode = createMockStepNode('compile_ast:2', '/step')
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [{ type: StructureType.STEP, path: '/step', title: 'Step' }],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      routerWithBasePath.mount(journeyInstance)

      // Assert
      expect(mockFrameworkAdapter.mountRouter).toHaveBeenCalledWith(mockMainRouter, '/forms/journey', expect.anything())
    })

    it('should normalize basePath by adding leading slash if missing', () => {
      // Arrange
      const optionsWithBasePath: ForgeOptions = {
        ...mockOptions,
        basePath: 'forms', // Missing leading slash
      }

      const routerWithBasePath = new ForgeRouter(mockDependencies, optionsWithBasePath)

      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode = createMockStepNode('compile_ast:2', '/step')
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [{ type: StructureType.STEP, path: '/step', title: 'Step' }],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      routerWithBasePath.mount(journeyInstance)

      // Assert
      const routes = routerWithBasePath.getRegisteredRoutes()
      expect(routes).toContainEqual({ method: 'GET', path: '/forms/journey/step' })
    })

    it('should normalize basePath by removing trailing slash', () => {
      // Arrange
      const optionsWithBasePath: ForgeOptions = {
        ...mockOptions,
        basePath: '/forms/', // Has trailing slash
      }

      const routerWithBasePath = new ForgeRouter(mockDependencies, optionsWithBasePath)

      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode = createMockStepNode('compile_ast:2', '/step')
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [{ type: StructureType.STEP, path: '/step', title: 'Step' }],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      routerWithBasePath.mount(journeyInstance)

      // Assert
      const routes = routerWithBasePath.getRegisteredRoutes()
      expect(routes).toContainEqual({ method: 'GET', path: '/forms/journey/step' })
    })

    it('should work with nested journeys when basePath is configured', () => {
      // Arrange
      const optionsWithBasePath: ForgeOptions = {
        ...mockOptions,
        basePath: '/forms',
      }

      const routerWithBasePath = new ForgeRouter(mockDependencies, optionsWithBasePath)

      const parentJourney = createMockJourneyNode('compile_ast:1', '/parent', 'parent-journey')
      const childJourney = createMockJourneyNode('compile_ast:2', '/child', 'child-journey')
      const stepNode = createMockStepNode('compile_ast:3', '/step')
      const artefact = createMockArtefact(
        stepNode,
        [parentJourney, childJourney],
        [parentJourney.id, childJourney.id, stepNode.id],
      )

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/parent',
        code: 'parent-journey',
        title: 'Parent Journey',
        children: [
          {
            type: StructureType.JOURNEY,
            path: '/child',
            code: 'child-journey',
            title: 'Child Journey',
            steps: [{ type: StructureType.STEP, path: '/step', title: 'Nested Step' }],
          },
        ],
      }

      const journeyInstance = createMockJourneyInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      routerWithBasePath.mount(journeyInstance)

      // Assert
      const routes = routerWithBasePath.getRegisteredRoutes()
      expect(routes).toContainEqual({ method: 'GET', path: '/forms/parent/child/step' })
      expect(routes).toContainEqual({ method: 'POST', path: '/forms/parent/child/step' })
    })
  })
})
