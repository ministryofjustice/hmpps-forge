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
  let routerSequence: number

  beforeEach(() => {
    vi.clearAllMocks()

    routerSequence = 0

    mockFrameworkAdapter = {
      createRouter: vi.fn().mockImplementation(() => ({ id: `router-${routerSequence++}` })),
      mountRouter: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      toStepRequest: vi.fn().mockReturnValue({
        method: 'GET',
        url: 'http://localhost/journey/step-one',
        baseUrl: '/journey',
        location: {
          origin: 'http://localhost',
          href: 'http://localhost/journey/step-one',
          pathname: '/journey/step-one',
          basePath: '/journey',
        },
        getHeader: () => undefined,
        getAllHeaders: () => ({}),
        getCookie: () => undefined,
        getAllCookies: () => ({}),
        getParam: () => undefined,
        getParams: () => ({}),
        getQuery: () => undefined,
        getAllQuery: () => ({}),
        getPost: () => undefined,
        getAllPost: () => ({}),
        getSession: () => undefined,
        getState: () => undefined,
        getAllState: () => ({}),
      }),
      toStepResponse: vi.fn().mockReturnValue({
        setHeader: vi.fn(),
        getHeader: vi.fn(),
        getAllHeaders: vi.fn(),
        setCookie: vi.fn(),
        getCookie: vi.fn(),
        getAllCookies: vi.fn(),
      }),
      redirect: vi.fn(),
      forwardError: vi.fn(),
      render: vi.fn(),
      applyResult: vi.fn(),
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
        compiledAccessLifecycle: vi.fn().mockReturnValue({ executed: true, outcome: 'continue' }),
      },
      navigationPlan: {
        entries: [],
        resumeConfigured: false,
        unreachableRedirect: 'entry',
        reachabilityDisabled: false,
        compiledStepValidations: new Map(),
        compiledNavigation: vi.fn().mockResolvedValue({
          evaluation: {
            currentStepId: stepNode.id,
            steps: [],
            defaultEntryRouteTemplatePath: undefined,
            frontierRouteTemplatePath: undefined,
            canonicalPathRouteTemplatePaths: [],
            progressExists: false,
            resumeActive: false,
            resumeOutcome: 'no-op',
            unreachableRedirect: 'entry',
          },
        }),
      },
      compiledAnswerPreparation: vi.fn(),
      compiledRender: vi.fn().mockReturnValue({ blocks: [], step: {}, ancestors: [] }),
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
      getCompilationContext: vi.fn().mockReturnValue(artefact),
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

    it('should call applyResult when a step handler is invoked', async () => {
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
      expect(mockFrameworkAdapter.applyResult).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'render' }),
        {},
        {},
        mockPackageDependencies.componentRegistry,
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
      expect(mockFrameworkAdapter.mountRouter).toHaveBeenCalledWith({ id: 'router-0' }, '/journey', { id: 'router-1' })
      expect(mockFrameworkAdapter.mountRouter).toHaveBeenCalledWith({ id: 'router-1' }, '/section', { id: 'router-2' })
      expect(mockFrameworkAdapter.get).toHaveBeenCalledWith({ id: 'router-2' }, '/details', expect.any(Function))
      expect(mockFrameworkAdapter.post).toHaveBeenCalledWith({ id: 'router-2' }, '/details', expect.any(Function))
    })

    it('should include base path segments in the route tree and root router mount path', () => {
      // Arrange
      const routerWithBase = new ForgeRouter(mockForgeDependencies, {
        basePath: '/forms',
        frameworkAdapter: { build: () => mockFrameworkAdapter },
      })
      const journeyNode = createJourneyNode('compile_ast:8', '/journey', 'test')
      const stepNode = createStepNode('compile_ast:9', '/step-one')
      const artefact = createArtefact([journeyNode, stepNode], [[journeyNode.id, stepNode.id]])
      const packageInstance = createPackageInstance([journeyNode], [stepNode], artefact)

      // Act
      routerWithBase.mount(packageInstance, mockForgeDependencies)

      // Assert
      const routeTree = routerWithBase.getRouteTree()

      expect(routeTree).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            segment: 'forms',
          }),
        ]),
      )
    })

    it('should throw DuplicateRouteError when two concrete routes share a URL template', () => {
      // Arrange
      const journeyNode = createJourneyNode('compile_ast:10', '/journey', 'test')
      const step1 = createStepNode('compile_ast:11', '/same-path')
      const step2 = createStepNode('compile_ast:12', '/same-path')
      const artefact = createArtefact(
        [journeyNode, step1, step2],
        [
          [journeyNode.id, step1.id],
          [journeyNode.id, step2.id],
        ],
      )
      const packageInstance = createPackageInstance([journeyNode], [step1, step2], artefact)

      // Act & Assert
      expect(() => router.mount(packageInstance, mockForgeDependencies)).toThrow(DuplicateRouteError)
    })
  })
})
