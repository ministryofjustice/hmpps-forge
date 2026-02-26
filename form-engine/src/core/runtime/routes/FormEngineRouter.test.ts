import { FormInstanceDependencies, NodeId, CompileAstNodeId } from '@form-engine/core/types/engine.type'
import { FormEngineOptions } from '@form-engine/core/FormEngine'
import { FrameworkAdapter, FrameworkAdapterBuilder } from '@form-engine/core/runtime/routes/types'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { StructureType } from '@form-engine/form/types/enums'
import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import DuplicateRouteError from '@form-engine/errors/DuplicateRouteError'
import FormInstance from '@form-engine/core/FormInstance'
import FormStepController from '@form-engine/core/runtime/routes/FormStepController'
import FormEngineRouter from './FormEngineRouter'

jest.mock('@form-engine/core/runtime/routes/FormStepController')

describe('FormEngineRouter', () => {
  let router: FormEngineRouter<unknown>
  let mockFrameworkAdapter: jest.Mocked<FrameworkAdapter<unknown, unknown, unknown>>
  let mockFrameworkAdapterBuilder: jest.Mocked<FrameworkAdapterBuilder<unknown, unknown, unknown>>
  let mockLogger: jest.Mocked<Console>
  let mockDependencies: FormInstanceDependencies
  let mockOptions: FormEngineOptions
  let mockMainRouter: unknown
  let mockControllerGet: jest.Mock
  let mockControllerPost: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockControllerGet = jest.fn().mockResolvedValue(undefined)
    mockControllerPost = jest.fn().mockResolvedValue(undefined)
    ;(FormStepController as unknown as jest.MockedClass<typeof FormStepController>).mockImplementation(
      () =>
        ({
          get: mockControllerGet,
          post: mockControllerPost,
        }) as unknown as FormStepController<unknown, unknown>,
    )

    mockMainRouter = { _type: 'main-router' }

    mockFrameworkAdapter = {
      createRouter: jest.fn().mockReturnValue(mockMainRouter),
      mountRouter: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      toStepRequest: jest.fn(),
      getBaseUrl: jest.fn(),
      redirect: jest.fn(),
      registerRedirect: jest.fn(),
      forwardError: jest.fn(),
      render: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<FrameworkAdapter<unknown, unknown, unknown>>

    mockFrameworkAdapterBuilder = {
      build: jest.fn().mockReturnValue(mockFrameworkAdapter),
    } as unknown as jest.Mocked<FrameworkAdapterBuilder<unknown, unknown, unknown>>

    mockLogger = {
      log: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<Console>

    mockDependencies = {
      frameworkAdapter: mockFrameworkAdapter,
      logger: mockLogger,
      componentRegistry: {} as any,
      functionRegistry: {} as any,
    }

    mockOptions = {
      frameworkAdapter: mockFrameworkAdapterBuilder,
    }

    router = new FormEngineRouter(mockDependencies, mockOptions)
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

  function createMockJourneyNode(id: CompileAstNodeId, path: string, code: string): JourneyASTNode {
    return {
      type: ASTNodeType.JOURNEY,
      id,
      properties: {
        path,
        code,
        title: `Journey ${code}`,
      },
    }
  }

  function createMockArtefact(stepNode: StepASTNode, journeyNodes: JourneyASTNode[], parentChain: NodeId[]) {
    const nodeRegistry = {
      get: jest.fn((nodeId: NodeId) => {
        if (nodeId === stepNode.id) {
          return stepNode
        }

        return journeyNodes.find(j => j.id === nodeId)
      }),
    }

    const metadataRegistry = {
      get: jest.fn((nodeId: NodeId, key: string) => {
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

    return { nodeRegistry, metadataRegistry }
  }

  function createMockFormInstance(
    compiledForm: Array<{ artefact: any; currentStepId: NodeId }>,
    config: JourneyDefinition,
  ): jest.Mocked<FormInstance> {
    const byStepId = new Map(compiledForm.map(compiled => [compiled.currentStepId, compiled]))
    const stepIndex = new Map(
      compiledForm.map(compiled => [
        compiled.currentStepId,
        compiled.artefact.nodeRegistry.get(compiled.currentStepId),
      ]),
    )

    const sharedArtefact = {
      nodeRegistry: {
        get: jest.fn((nodeId: NodeId) => {
          for (const compiled of compiledForm) {
            const node = compiled.artefact.nodeRegistry.get(nodeId)

            if (node !== undefined) {
              return node
            }
          }

          return undefined
        }),
      },
      metadataRegistry: {
        get: jest.fn((nodeId: NodeId, key: string) => {
          for (const compiled of compiledForm) {
            const metadata = compiled.artefact.metadataRegistry.get(nodeId, key)

            if (metadata !== undefined) {
              return metadata
            }
          }

          return undefined
        }),
      },
    }

    return {
      getCompiledForm: jest.fn().mockReturnValue(compiledForm),
      getCompiledStep: jest.fn().mockImplementation((stepId: NodeId) => {
        const compiledStep = byStepId.get(stepId)

        if (!compiledStep) {
          throw new Error(`Unable to resolve compiled step for ${stepId}`)
        }

        return Promise.resolve(compiledStep)
      }),
      getStepIndex: jest.fn().mockImplementation(() => new Map(stepIndex)),
      getSharedCompilationArtefact: jest.fn().mockReturnValue(sharedArtefact),
      getConfiguration: jest.fn().mockReturnValue(config),
      getFormCode: jest.fn().mockReturnValue(config.code),
      getFormTitle: jest.fn().mockReturnValue(config.title),
    } as unknown as jest.Mocked<FormInstance>
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

  describe('mountForm()', () => {
    it('should mount routes without eagerly resolving the full compiled form', () => {
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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mountForm(formInstance)

      // Assert
      expect(formInstance.getStepIndex).toHaveBeenCalledTimes(1)
      expect(formInstance.getSharedCompilationArtefact).toHaveBeenCalledTimes(1)
      expect(formInstance.getCompiledForm).not.toHaveBeenCalled()
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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mountForm(formInstance)

      // Assert
      expect(mockFrameworkAdapter.get).toHaveBeenCalledWith(expect.anything(), '/step-one', expect.any(Function))
      expect(mockFrameworkAdapter.post).toHaveBeenCalledWith(expect.anything(), '/step-one', expect.any(Function))
    })

    it('should resolve compiled step at request time, not mount time', async () => {
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
      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mountForm(formInstance)

      // Assert mount-time behaviour
      expect(formInstance.getCompiledStep).not.toHaveBeenCalled()

      const getHandler = mockFrameworkAdapter.get.mock.calls[0][2] as (req: unknown, res: unknown) => Promise<void>

      await getHandler({}, {})
      expect(formInstance.getCompiledStep).toHaveBeenCalledTimes(1)
      expect(formInstance.getCompiledStep).toHaveBeenCalledWith(stepNode.id)
      expect(mockControllerGet).toHaveBeenCalledTimes(1)
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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mountForm(formInstance)

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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mountForm(formInstance)

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

      const formInstance = createMockFormInstance(
        [
          { artefact: artefact1, currentStepId: stepNode1.id },
          { artefact: artefact2, currentStepId: stepNode2.id },
        ],
        config,
      )

      // Act & Assert
      expect(() => router.mountForm(formInstance)).toThrow(DuplicateRouteError)
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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mountForm(formInstance)

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

      const formInstance = createMockFormInstance(
        [
          { artefact: artefact1, currentStepId: stepNode1.id },
          { artefact: artefact2, currentStepId: stepNode2.id },
        ],
        config,
      )

      // Act
      router.mountForm(formInstance)

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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mountForm(formInstance)

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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mountForm(formInstance)

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

      const formInstance = createMockFormInstance(
        [
          { artefact: artefact1, currentStepId: stepNode1.id },
          { artefact: artefact2, currentStepId: stepNode2.id },
        ],
        config,
      )

      // Act
      router.mountForm(formInstance)

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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mountForm(formInstance)

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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mountForm(formInstance)

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

      const formInstance1 = createMockFormInstance([{ artefact: artefact1, currentStepId: step1.id }], config1)
      const formInstance2 = createMockFormInstance([{ artefact: artefact2, currentStepId: step2.id }], config2)

      // Act
      router.mountForm(formInstance1)
      router.mountForm(formInstance2)

      // Assert
      const routes = router.getRegisteredRoutes()
      expect(routes).toHaveLength(4)
      expect(routes).toContainEqual({ method: 'GET', path: '/form-one/start' })
      expect(routes).toContainEqual({ method: 'POST', path: '/form-one/start' })
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

      const formInstance1 = createMockFormInstance([{ artefact: artefact1, currentStepId: step1.id }], config1)
      const formInstance2 = createMockFormInstance([{ artefact: artefact2, currentStepId: step2.id }], config2)

      // Act
      router.mountForm(formInstance1)
      router.mountForm(formInstance2)

      // Assert
      const metadata = router.getNavigationMetadata()
      expect(metadata).toHaveLength(2)
      expect(metadata[0].title).toBe('Form One')
      expect(metadata[1].title).toBe('Form Two')
    })
  })

  describe('journey redirect handling', () => {
    it('should register redirect when entryPath is defined', () => {
      // Arrange
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      journeyNode.properties.entryPath = '/first-step'
      const stepNode = createMockStepNode('compile_ast:2', '/first-step')
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        entryPath: '/first-step',
        steps: [{ type: StructureType.STEP, path: '/first-step', title: 'First Step' }],
      }

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mountForm(formInstance)

      // Assert
      expect(mockFrameworkAdapter.registerRedirect).toHaveBeenCalledWith(expect.anything(), '/', '/journey/first-step')
    })

    it('should register redirect to step with isEntryPoint when entryPath not defined', () => {
      // Arrange
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      const stepNode = createMockStepNode('compile_ast:2', '/entry')
      stepNode.properties.isEntryPoint = true
      journeyNode.properties.steps = [stepNode]
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        steps: [{ type: StructureType.STEP, path: '/entry', title: 'Entry Step', isEntryPoint: true }],
      }

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mountForm(formInstance)

      // Assert
      expect(mockFrameworkAdapter.registerRedirect).toHaveBeenCalledWith(expect.anything(), '/', '/journey/entry')
    })

    it('should not register redirect when no entry point defined', () => {
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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mountForm(formInstance)

      // Assert
      expect(mockFrameworkAdapter.registerRedirect).not.toHaveBeenCalled()
    })

    it('should handle nested journey redirects', () => {
      // Arrange
      const parentJourney = createMockJourneyNode('compile_ast:1', '/parent', 'parent-journey')
      parentJourney.properties.entryPath = '/first'

      const childJourney = createMockJourneyNode('compile_ast:2', '/child', 'child-journey')
      childJourney.properties.entryPath = '/nested'

      const stepNode = createMockStepNode('compile_ast:3', '/nested')
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
        entryPath: '/first',
        children: [
          {
            type: StructureType.JOURNEY,
            path: '/child',
            code: 'child-journey',
            title: 'Child Journey',
            entryPath: '/nested',
            steps: [{ type: StructureType.STEP, path: '/nested', title: 'Nested Step' }],
          },
        ],
      }

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      router.mountForm(formInstance)

      // Assert - both journey routers should have redirect handlers
      expect(mockFrameworkAdapter.registerRedirect).toHaveBeenCalledTimes(2)
      expect(mockFrameworkAdapter.registerRedirect).toHaveBeenCalledWith(expect.anything(), '/', '/parent/first')
      expect(mockFrameworkAdapter.registerRedirect).toHaveBeenCalledWith(expect.anything(), '/', '/parent/child/nested')
    })

    it('should prefer entryPath over isEntryPoint step', () => {
      // Arrange
      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      journeyNode.properties.entryPath = '/explicit-entry'

      const entryPointStep = createMockStepNode('compile_ast:2', '/entry-point')
      entryPointStep.properties.isEntryPoint = true

      const explicitStep = createMockStepNode('compile_ast:3', '/explicit-entry')
      journeyNode.properties.steps = [entryPointStep, explicitStep]

      const artefact = createMockArtefact(entryPointStep, [journeyNode], [journeyNode.id, entryPointStep.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        entryPath: '/explicit-entry',
        steps: [
          { type: StructureType.STEP, path: '/entry-point', title: 'Entry Point Step', isEntryPoint: true },
          { type: StructureType.STEP, path: '/explicit-entry', title: 'Explicit Entry' },
        ],
      }

      const formInstance = createMockFormInstance([{ artefact, currentStepId: entryPointStep.id }], config)

      // Act
      router.mountForm(formInstance)

      // Assert - should redirect to entryPath, not isEntryPoint step
      expect(mockFrameworkAdapter.registerRedirect).toHaveBeenCalledWith(
        expect.anything(),
        '/',
        '/journey/explicit-entry',
      )
    })
  })

  describe('basePath configuration', () => {
    it('should prefix routes with basePath when configured', () => {
      // Arrange
      const optionsWithBasePath: FormEngineOptions = {
        ...mockOptions,
        basePath: '/forms',
      }

      const routerWithBasePath = new FormEngineRouter(mockDependencies, optionsWithBasePath)

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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      routerWithBasePath.mountForm(formInstance)

      // Assert
      const routes = routerWithBasePath.getRegisteredRoutes()
      expect(routes).toContainEqual({ method: 'GET', path: '/forms/journey/step-one' })
      expect(routes).toContainEqual({ method: 'POST', path: '/forms/journey/step-one' })
    })

    it('should include basePath in navigation metadata', () => {
      // Arrange
      const optionsWithBasePath: FormEngineOptions = {
        ...mockOptions,
        basePath: '/forms',
      }

      const routerWithBasePath = new FormEngineRouter(mockDependencies, optionsWithBasePath)

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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      routerWithBasePath.mountForm(formInstance)

      // Assert
      const metadata = routerWithBasePath.getNavigationMetadata()
      expect(metadata[0].path).toBe('/forms/journey')
      expect(metadata[0].children[0]).toEqual({ title: 'Step One', path: '/forms/journey/step-one' })
    })

    it('should include basePath in redirect paths', () => {
      // Arrange
      const optionsWithBasePath: FormEngineOptions = {
        ...mockOptions,
        basePath: '/forms',
      }

      const routerWithBasePath = new FormEngineRouter(mockDependencies, optionsWithBasePath)

      const journeyNode = createMockJourneyNode('compile_ast:1', '/journey', 'test-journey')
      journeyNode.properties.entryPath = '/first-step'
      const stepNode = createMockStepNode('compile_ast:2', '/first-step')
      const artefact = createMockArtefact(stepNode, [journeyNode], [journeyNode.id, stepNode.id])

      const config: JourneyDefinition = {
        type: StructureType.JOURNEY,
        path: '/journey',
        code: 'test-journey',
        title: 'Test Journey',
        entryPath: '/first-step',
        steps: [{ type: StructureType.STEP, path: '/first-step', title: 'First Step' }],
      }

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      routerWithBasePath.mountForm(formInstance)

      // Assert
      expect(mockFrameworkAdapter.registerRedirect).toHaveBeenCalledWith(
        expect.anything(),
        '/',
        '/forms/journey/first-step',
      )
    })

    it('should mount first journey router at basePath + journeyPath', () => {
      // Arrange
      const optionsWithBasePath: FormEngineOptions = {
        ...mockOptions,
        basePath: '/forms',
      }

      const routerWithBasePath = new FormEngineRouter(mockDependencies, optionsWithBasePath)

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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      routerWithBasePath.mountForm(formInstance)

      // Assert
      expect(mockFrameworkAdapter.mountRouter).toHaveBeenCalledWith(mockMainRouter, '/forms/journey', expect.anything())
    })

    it('should normalize basePath by adding leading slash if missing', () => {
      // Arrange
      const optionsWithBasePath: FormEngineOptions = {
        ...mockOptions,
        basePath: 'forms', // Missing leading slash
      }

      const routerWithBasePath = new FormEngineRouter(mockDependencies, optionsWithBasePath)

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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      routerWithBasePath.mountForm(formInstance)

      // Assert
      const routes = routerWithBasePath.getRegisteredRoutes()
      expect(routes).toContainEqual({ method: 'GET', path: '/forms/journey/step' })
    })

    it('should normalize basePath by removing trailing slash', () => {
      // Arrange
      const optionsWithBasePath: FormEngineOptions = {
        ...mockOptions,
        basePath: '/forms/', // Has trailing slash
      }

      const routerWithBasePath = new FormEngineRouter(mockDependencies, optionsWithBasePath)

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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      routerWithBasePath.mountForm(formInstance)

      // Assert
      const routes = routerWithBasePath.getRegisteredRoutes()
      expect(routes).toContainEqual({ method: 'GET', path: '/forms/journey/step' })
    })

    it('should work with nested journeys when basePath is configured', () => {
      // Arrange
      const optionsWithBasePath: FormEngineOptions = {
        ...mockOptions,
        basePath: '/forms',
      }

      const routerWithBasePath = new FormEngineRouter(mockDependencies, optionsWithBasePath)

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

      const formInstance = createMockFormInstance([{ artefact, currentStepId: stepNode.id }], config)

      // Act
      routerWithBasePath.mountForm(formInstance)

      // Assert
      const routes = routerWithBasePath.getRegisteredRoutes()
      expect(routes).toContainEqual({ method: 'GET', path: '/forms/parent/child/step' })
      expect(routes).toContainEqual({ method: 'POST', path: '/forms/parent/child/step' })
    })
  })
})
