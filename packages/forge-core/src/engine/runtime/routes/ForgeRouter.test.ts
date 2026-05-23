import type { FrameworkAdapter } from '../../../framework/types/adapter.type'
import { ASTNodeType } from '../../types/enums'
import { CompileAstNodeId, NodeId } from '../../types/ast.type'
import { ForgeDependencies, PackageDependencies } from '../../types/engine.type'
import { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import type { JourneyRuntimePlan } from '../../types/runtimePlans.type'
import type { CompiledStep } from '../../types/compilationArtefacts.type'
import ASTNodeTree from '../../compilation/node-tree/ASTNodeTree'
import DuplicateRouteError from '../../errors/DuplicateRouteError'
import type PackageInstance from '../../PackageInstance'
import ForgeRouter from './ForgeRouter'
import StepController from './StepController'
import JourneyController from './JourneyController'

vi.mock('./StepController')
vi.mock('./JourneyController')

interface MockRouter {
  id: string
}

interface MockArtefact {
  nodeRegistry: {
    get: Mock<(nodeId: NodeId) => JourneyASTNode | StepASTNode | undefined>
  }
  astNodeTree: ASTNodeTree
}

describe('ForgeRouter', () => {
  let router: ForgeRouter<MockRouter>
  let mockFrameworkAdapter: Mocked<FrameworkAdapter<MockRouter, unknown, unknown>>
  let mockPackageDependencies: PackageDependencies
  let mockForgeDependencies: ForgeDependencies
  let mockControllerGet: Mock
  let mockControllerPost: Mock
  let mockJourneyControllerGet: Mock
  let routerSequence: number

  beforeEach(() => {
    vi.clearAllMocks()

    mockControllerGet = vi.fn().mockResolvedValue(undefined)
    mockControllerPost = vi.fn().mockResolvedValue(undefined)
    mockJourneyControllerGet = vi.fn().mockResolvedValue(undefined)
    routerSequence = 0
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

    mockFrameworkAdapter = {
      createRouter: vi.fn().mockImplementation(() => ({ id: `router-${routerSequence++}` })),
      mountRouter: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      toStepRequest: vi.fn(),
      toStepResponse: vi.fn(),
      redirect: vi.fn(),
      forwardError: vi.fn(),
      render: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<FrameworkAdapter<MockRouter, unknown, unknown>>

    mockPackageDependencies = {
      componentRegistry: {} as never,
      functionRegistry: {} as never,
    }

    mockForgeDependencies = {
      frameworkAdapter: mockFrameworkAdapter,
      logger: console,
    }

    router = new ForgeRouter(mockForgeDependencies, { frameworkAdapter: { build: () => mockFrameworkAdapter } })
  })

  function createStepNode(id: CompileAstNodeId, path: string, title = `Step ${path}`): StepASTNode {
    return {
      id,
      type: ASTNodeType.STEP,
      properties: {
        path,
        title,
      },
    }
  }

  function createJourneyNode(
    id: CompileAstNodeId,
    path: string,
    code: string,
    title = `Journey ${code}`,
  ): JourneyASTNode {
    return {
      id,
      type: ASTNodeType.JOURNEY,
      properties: {
        path,
        code,
        title,
      },
    }
  }

  function createArtefact(nodes: Array<JourneyASTNode | StepASTNode>, chains: NodeId[][]): MockArtefact {
    const nodesById = new Map<NodeId, JourneyASTNode | StepASTNode>(nodes.map(node => [node.id, node]))
    const astNodeTree = new ASTNodeTree()

    chains.forEach(chain => {
      chain.forEach((nodeId, index) => {
        astNodeTree.addNode(nodeId, chain[index - 1])
      })
    })

    return {
      nodeRegistry: {
        get: vi.fn((nodeId: NodeId) => nodesById.get(nodeId)),
      },
      astNodeTree,
    }
  }

  function createCompiledStep(stepNode: StepASTNode): CompiledStep {
    return {
      runtimePlan: {
        stepId: stepNode.id,
        path: stepNode.properties.path,
        staticData: {},
      },
      navigationPlan: {
        entries: [],
        resumeConfigured: false,
        unreachableRedirect: 'entry',
        reachabilityDisabled: false,
        compiledStepValidations: new Map(),
      },
      compiledAnswerPreparation: undefined,
    }
  }

  function createJourneyRuntimePlan(journeyNode: JourneyASTNode): JourneyRuntimePlan {
    return {
      path: journeyNode.properties.path,
      staticData: {},
      navigationPlan: {
        entries: [],
        resumeConfigured: false,
        unreachableRedirect: 'entry',
        reachabilityDisabled: false,
        compiledStepValidations: new Map(),
      },
    }
  }

  function createPackageInstance(
    journeys: JourneyASTNode[],
    steps: StepASTNode[],
    artefact: MockArtefact,
  ): Mocked<PackageInstance> {
    const compiledSteps = new Map<NodeId, CompiledStep>(steps.map(step => [step.id, createCompiledStep(step)]))
    const journeyPlans = new Map<NodeId, JourneyRuntimePlan>(
      journeys.map(journey => [journey.id, createJourneyRuntimePlan(journey)]),
    )

    return {
      getDependencies: vi.fn().mockReturnValue(mockPackageDependencies),
      getStepIndex: vi.fn().mockReturnValue(new Map(steps.map(step => [step.id, step]))),
      getJourneyIndex: vi.fn().mockReturnValue(new Map(journeys.map(journey => [journey.id, journey]))),
      getSharedCompilationArtefact: vi.fn().mockReturnValue(artefact),
      getCompiledStep: vi.fn((stepId: NodeId) => compiledSteps.get(stepId)),
      getJourneyRuntimePlan: vi.fn((journeyId: NodeId) => journeyPlans.get(journeyId)),
    } as unknown as Mocked<PackageInstance>
  }

  describe('getRouter()', () => {
    it('should return the main router', () => {
      // Act
      const result = router.getRouter()

      // Assert
      expect(result).toEqual({ id: 'router-0' })
    })
  })

  describe('getRouteTree()', () => {
    it('should return an empty tree before journeys are mounted', () => {
      // Act
      const result = router.getRouteTree()

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('mount()', () => {
    it('should mount journey roots and step routes and return the route count', () => {
      // Arrange
      const journeyNode = createJourneyNode('compile_ast:1', '/journey', 'test')
      const stepNode = createStepNode('compile_ast:2', '/step-one')
      const artefact = createArtefact([journeyNode, stepNode], [[journeyNode.id, stepNode.id]])
      const packageInstance = createPackageInstance([journeyNode], [stepNode], artefact)

      // Act
      const routeCount = router.mount(packageInstance, mockForgeDependencies)

      // Assert
      expect(routeCount).toBe(3)
      expect(mockFrameworkAdapter.mountRouter).toHaveBeenCalledWith({ id: 'router-0' }, '/journey', { id: 'router-1' })
      expect(mockFrameworkAdapter.get).toHaveBeenCalledWith({ id: 'router-1' }, '/step-one', expect.any(Function))
      expect(mockFrameworkAdapter.post).toHaveBeenCalledWith({ id: 'router-1' }, '/step-one', expect.any(Function))
      expect(mockFrameworkAdapter.get).toHaveBeenCalledWith({ id: 'router-1' }, '/', expect.any(Function))
    })

    it('should pass the stored route tree to lazily created step controllers', async () => {
      // Arrange
      const journeyNode = createJourneyNode('compile_ast:3', '/journey', 'test')
      const stepNode = createStepNode('compile_ast:4', '/step-one')
      const artefact = createArtefact([journeyNode, stepNode], [[journeyNode.id, stepNode.id]])
      const packageInstance = createPackageInstance([journeyNode], [stepNode], artefact)

      router.mount(packageInstance, mockForgeDependencies)

      const stepGetHandler = mockFrameworkAdapter.get.mock.calls.find(call => call[1] === '/step-one')?.[2] as
        | ((req: unknown, res: unknown) => Promise<void>)
        | undefined

      if (!stepGetHandler) {
        throw new Error('Step GET handler was not mounted')
      }

      // Act
      await stepGetHandler({}, {})

      // Assert
      expect(StepController).toHaveBeenCalledWith(
        createCompiledStep(stepNode),
        mockPackageDependencies,
        mockForgeDependencies,
        router.getRouteTree(),
        '/journey/step-one',
        expect.objectContaining({
          routeTemplatePathByStepId: expect.any(Map),
          stepIdByRouteTemplatePath: expect.any(Map),
        }),
      )
    })

    it('should build a route hierarchy that allows concrete routes to have children', () => {
      // Arrange
      const journeyNode = createJourneyNode('compile_ast:5', '/journey', 'test')
      const childJourneyNode = createJourneyNode('compile_ast:6', '/section', 'section', 'Section')
      const stepNode = createStepNode('compile_ast:7', '/details', 'Details')
      const artefact = createArtefact(
        [journeyNode, childJourneyNode, stepNode],
        [
          [journeyNode.id, childJourneyNode.id],
          [journeyNode.id, childJourneyNode.id, stepNode.id],
        ],
      )
      const packageInstance = createPackageInstance([journeyNode, childJourneyNode], [stepNode], artefact)

      // Act
      router.mount(packageInstance, mockForgeDependencies)

      // Assert
      expect(router.getRouteTree()).toMatchObject([
        {
          segment: 'journey',
          templatePath: '/journey',
          route: { kind: 'journey', nodeId: journeyNode.id, title: 'Journey test' },
          children: [
            {
              segment: 'section',
              templatePath: '/journey/section',
              route: { kind: 'journey', nodeId: childJourneyNode.id, title: 'Section' },
              children: [
                {
                  segment: 'details',
                  templatePath: '/journey/section/details',
                  route: { kind: 'step', nodeId: stepNode.id, title: 'Details' },
                },
              ],
            },
          ],
        },
      ])
    })

    it('should include base path segments in the route tree and root router mount path', () => {
      // Arrange
      const routerWithBasePath = new ForgeRouter(mockForgeDependencies, {
        frameworkAdapter: { build: () => mockFrameworkAdapter },
        basePath: '/forms',
      })
      const journeyNode = createJourneyNode('compile_ast:8', '/journey', 'test')
      const stepNode = createStepNode('compile_ast:9', '/step-one')
      const artefact = createArtefact([journeyNode, stepNode], [[journeyNode.id, stepNode.id]])
      const packageInstance = createPackageInstance([journeyNode], [stepNode], artefact)

      // Act
      const routeCount = routerWithBasePath.mount(packageInstance, mockForgeDependencies)

      // Assert
      expect(routeCount).toBe(3)
      expect(mockFrameworkAdapter.mountRouter).toHaveBeenCalledWith({ id: 'router-1' }, '/forms/journey', {
        id: 'router-2',
      })
      expect(routerWithBasePath.getRouteTree()).toMatchObject([
        {
          segment: 'forms',
          templatePath: '/forms',
          children: [
            {
              segment: 'journey',
              templatePath: '/forms/journey',
              route: { kind: 'journey', nodeId: journeyNode.id },
              children: [{ segment: 'step-one', templatePath: '/forms/journey/step-one' }],
            },
          ],
        },
      ])
    })

    it('should throw DuplicateRouteError when two concrete routes share a URL template', () => {
      // Arrange
      const journeyNode = createJourneyNode('compile_ast:10', '/journey', 'test')
      const firstStep = createStepNode('compile_ast:11', '/duplicate')
      const secondStep = createStepNode('compile_ast:12', '/duplicate')
      const artefact = createArtefact(
        [journeyNode, firstStep, secondStep],
        [
          [journeyNode.id, firstStep.id],
          [journeyNode.id, secondStep.id],
        ],
      )
      const packageInstance = createPackageInstance([journeyNode], [firstStep, secondStep], artefact)

      // Act
      const act = () => router.mount(packageInstance, mockForgeDependencies)

      // Assert
      expect(act).toThrow(DuplicateRouteError)
      expect(mockFrameworkAdapter.get).not.toHaveBeenCalled()
      expect(mockFrameworkAdapter.post).not.toHaveBeenCalled()
    })
  })
})
