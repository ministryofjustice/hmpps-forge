import type { FrameworkAdapter } from '../../../framework/types/adapter.type'
import { CompileAstNodeId, NodeId } from '../../contracts/ast/ast.type'
import { ForgeDependencies, PackageDependencies } from '../../contracts/ast/engine.type'
import type { JourneyRouteDescriptor, StepRouteDescriptor } from '../../contracts/routing/routeDescriptors.type'
import type { CompiledJourney, CompiledStep } from '../../contracts/plans/compilationArtefacts.type'
import DuplicateRouteError from '../../errors/DuplicateRouteError'
import type PackageInstance from '../../PackageInstance'
import ForgeRouter from './ForgeRouter'
import { ForgeInstrumentation } from '../../../instrumentation/ForgeInstrumentation'

interface MockRouter {
  id: string
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
      instrumentation: new ForgeInstrumentation(undefined, console),
    }

    router = new ForgeRouter(mockForgeDependencies, { frameworkAdapter: { build: () => mockFrameworkAdapter } })
  })

  function createJourneyDescriptor(
    id: CompileAstNodeId,
    path: string,
    ancestorJourneyIds: readonly NodeId[],
    title = `Journey ${path}`,
  ): JourneyRouteDescriptor {
    return { nodeId: id, path, title, ancestorJourneyIds }
  }

  function createStepDescriptor(
    id: CompileAstNodeId,
    path: string,
    ancestorJourneyIds: readonly NodeId[],
    title = `Step ${path}`,
  ): StepRouteDescriptor {
    return { nodeId: id, path, title, ancestorJourneyIds }
  }

  function createCompiledStep(descriptor: StepRouteDescriptor): CompiledStep {
    return {
      runtimePlan: {
        stepId: descriptor.nodeId,
        path: descriptor.path,
        staticData: {},
      },
      compiledAccessLifecycle: vi.fn().mockReturnValue({ executed: true, outcome: 'continue' }),
      navigationPlan: {
        entries: [],
        resumeConfigured: false,
        unreachableRedirect: 'entry',
        reachabilityDisabled: false,
        compiledStepValidations: new Map(),
        compiledNavigation: vi.fn().mockResolvedValue({
          evaluation: {
            currentStepId: descriptor.nodeId,
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

  function createCompiledJourney(descriptor: JourneyRouteDescriptor): CompiledJourney {
    return {
      runtimePlan: {
        journeyId: descriptor.nodeId,
        path: descriptor.path,
        staticData: {},
      },
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
    journeys: JourneyRouteDescriptor[],
    steps: StepRouteDescriptor[],
  ): Mocked<PackageInstance> {
    const compiledSteps = new Map<NodeId, CompiledStep>(steps.map(step => [step.nodeId, createCompiledStep(step)]))
    const compiledJourneys = new Map<NodeId, CompiledJourney>(
      journeys.map(journey => [journey.nodeId, createCompiledJourney(journey)]),
    )

    return {
      getDependencies: vi.fn().mockReturnValue(mockPackageDependencies),
      getStepRouteIndex: vi.fn().mockReturnValue(new Map(steps.map(step => [step.nodeId, step]))),
      getJourneyRouteIndex: vi.fn().mockReturnValue(new Map(journeys.map(journey => [journey.nodeId, journey]))),
      getCompiledStep: vi.fn((stepId: NodeId) => compiledSteps.get(stepId)),
      getCompiledJourney: vi.fn((journeyId: NodeId) => compiledJourneys.get(journeyId)),
      getJourneyCode: vi.fn().mockReturnValue('test-journey'),
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
      const journey = createJourneyDescriptor('compile_ast:1', '/journey', ['compile_ast:1'], 'test')
      const step = createStepDescriptor('compile_ast:2', '/step-one', ['compile_ast:1'])
      const packageInstance = createPackageInstance([journey], [step])

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
      const journey = createJourneyDescriptor('compile_ast:3', '/journey', ['compile_ast:3'], 'test')
      const step = createStepDescriptor('compile_ast:4', '/step-one', ['compile_ast:3'])
      const packageInstance = createPackageInstance([journey], [step])

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
      const journey = createJourneyDescriptor('compile_ast:5', '/journey', ['compile_ast:5'], 'test')
      const childJourney = createJourneyDescriptor(
        'compile_ast:6',
        '/section',
        ['compile_ast:5', 'compile_ast:6'],
        'Section',
      )
      const step = createStepDescriptor('compile_ast:7', '/details', ['compile_ast:5', 'compile_ast:6'], 'Details')
      const packageInstance = createPackageInstance([journey, childJourney], [step])

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
      const journey = createJourneyDescriptor('compile_ast:8', '/journey', ['compile_ast:8'], 'test')
      const step = createStepDescriptor('compile_ast:9', '/step-one', ['compile_ast:8'])
      const packageInstance = createPackageInstance([journey], [step])

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
      const journey = createJourneyDescriptor('compile_ast:10', '/journey', ['compile_ast:10'], 'test')
      const step1 = createStepDescriptor('compile_ast:11', '/same-path', ['compile_ast:10'])
      const step2 = createStepDescriptor('compile_ast:12', '/same-path', ['compile_ast:10'])
      const packageInstance = createPackageInstance([journey], [step1, step2])

      // Act & Assert
      expect(() => router.mount(packageInstance, mockForgeDependencies)).toThrow(DuplicateRouteError)
    })
  })
})
