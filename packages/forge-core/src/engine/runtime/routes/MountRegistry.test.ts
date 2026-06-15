import { CompileAstNodeId, NodeId } from '../../contracts/ast/ast.type'
import { PackageDependencies } from '../../contracts/ast/engine.type'
import type { RouteDescriptor } from '../../contracts/routing/routeDescriptors.type'
import type { CompiledJourney, CompiledStep } from '../../contracts/plans/compilationArtefacts.type'
import DuplicateRouteError from '../../errors/DuplicateRouteError'
import type PackageInstance from '../../PackageInstance'
import MountRegistry from './MountRegistry'

describe('MountRegistry', () => {
  let registry: MountRegistry
  let mockPackageDependencies: PackageDependencies

  beforeEach(() => {
    vi.clearAllMocks()

    mockPackageDependencies = {
      componentRegistry: { _id: 'component-registry' } as never,
      functionRegistry: {} as never,
    }

    registry = new MountRegistry()
  })

  function createJourneyDescriptor(
    id: CompileAstNodeId,
    path: string,
    ancestorJourneyNodeIds: readonly NodeId[],
    title = `Journey ${path}`,
  ): RouteDescriptor {
    return { nodeId: id, path, title, ancestorJourneyNodeIds }
  }

  function createStepDescriptor(
    id: CompileAstNodeId,
    path: string,
    ancestorJourneyNodeIds: readonly NodeId[],
    title = `Step ${path}`,
  ): RouteDescriptor {
    return { nodeId: id, path, title, ancestorJourneyNodeIds }
  }

  function createCompiledStep(descriptor: RouteDescriptor): CompiledStep {
    return {
      runtimePlan: {
        nodeId: descriptor.nodeId,
        path: descriptor.path,
        staticData: {},
      },
      accessLifecyclePlan: { accessHooks: [] },
      navigationPlan: {
        navigationSteps: [],
        resumeConfigured: false,
        resumeAlways: false,
        unreachableRedirect: 'entry',
        reachabilityDisabled: false,
      },
      answerPreparationPlan: {
        items: [],
      },
      renderPlan: { renderBlocks: [], nestedBlocks: new Map() },
      submitLifecyclePlan: { submitHooks: [] },
      entryValidationPlan: { entryValidationRules: [] },
      validationPlan: { fieldValidations: [] },
      materialisationPlan: { roots: [] },
    }
  }

  function createCompiledJourney(descriptor: RouteDescriptor): CompiledJourney {
    return {
      runtimePlan: {
        nodeId: descriptor.nodeId,
        path: descriptor.path,
        staticData: {},
      },
      accessLifecyclePlan: { accessHooks: [] },
      navigationPlan: {
        navigationSteps: [],
        resumeConfigured: false,
        resumeAlways: false,
        unreachableRedirect: 'entry',
        reachabilityDisabled: false,
      },
      answerPreparationPlan: {
        items: [],
      },
      materialisationPlan: { roots: [] },
    }
  }

  function createPackageInstance(
    journeys: RouteDescriptor[],
    steps: RouteDescriptor[],
    journeyCode = 'test-journey',
  ): Mocked<PackageInstance> {
    const compiledSteps = new Map<NodeId, CompiledStep>(steps.map(step => [step.nodeId, createCompiledStep(step)]))
    const compiledJourneys = new Map<NodeId, CompiledJourney>(
      journeys.map(journey => [journey.nodeId, createCompiledJourney(journey)]),
    )

    return {
      getDependencies: vi.fn().mockReturnValue(mockPackageDependencies),
      getStepRouteIndex: vi.fn().mockReturnValue(new Map(steps.map(step => [step.nodeId, step]))),
      getJourneyRouteIndex: vi.fn().mockReturnValue(new Map(journeys.map(journey => [journey.nodeId, journey]))),
      getCompiledStep: vi.fn((stepNodeId: NodeId) => compiledSteps.get(stepNodeId)),
      getCompiledJourney: vi.fn((journeyNodeId: NodeId) => compiledJourneys.get(journeyNodeId)),
      getJourneyCode: vi.fn().mockReturnValue(journeyCode),
    } as unknown as Mocked<PackageInstance>
  }

  describe('mount()', () => {
    it('should return the count of registered routes', () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:1', '/journey', ['compile_ast:1'], 'test')
      const step = createStepDescriptor('compile_ast:2', '/step-one', ['compile_ast:1'])
      const packageInstance = createPackageInstance([journey], [step])

      // Act
      const routeCount = registry.mount(packageInstance)

      // Assert
      expect(routeCount).toBe(2)
    })

    it('should throw DuplicateRouteError when two concrete routes share a URL template', () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:10', '/journey', ['compile_ast:10'], 'test')
      const step1 = createStepDescriptor('compile_ast:11', '/same-path', ['compile_ast:10'])
      const step2 = createStepDescriptor('compile_ast:12', '/same-path', ['compile_ast:10'])
      const packageInstance = createPackageInstance([journey], [step1, step2])

      // Act & Assert
      expect(() => registry.mount(packageInstance)).toThrow(DuplicateRouteError)
    })
  })

  describe('getTopology()', () => {
    it('should expose a step route (GET + POST) and a journey route (GET) as data', () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:1', '/journey', ['compile_ast:1'], 'My Journey')
      const step = createStepDescriptor('compile_ast:2', '/step-one', ['compile_ast:1'], 'Step One')
      const packageInstance = createPackageInstance([journey], [step])

      // Act
      registry.mount(packageInstance)
      const { routes } = registry.getTopology()

      // Assert
      expect(routes).toEqual([
        {
          nodeId: 'test-journey::compile_ast:2',
          kind: 'step',
          templatePath: '/journey/step-one',
          basePath: '/journey',
          methods: ['GET', 'POST'],
          title: 'Step One',
        },
        {
          nodeId: 'test-journey::compile_ast:1',
          kind: 'journey',
          templatePath: '/journey',
          basePath: '/journey',
          methods: ['GET'],
          title: 'My Journey',
        },
      ])
    })

    it('should bake nested journey segments into step template paths', () => {
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
      registry.mount(packageInstance)
      const stepRoute = registry.getTopology().routes.find(route => route.kind === 'step')

      // Assert
      expect(stepRoute).toMatchObject({
        templatePath: '/journey/section/details',
        basePath: '/journey/section',
        methods: ['GET', 'POST'],
      })
    })

    it('should include the configured base path in template paths', () => {
      // Arrange
      const registryWithBase = new MountRegistry('/forms')
      const journey = createJourneyDescriptor('compile_ast:8', '/journey', ['compile_ast:8'], 'test')
      const step = createStepDescriptor('compile_ast:9', '/step-one', ['compile_ast:8'])
      const packageInstance = createPackageInstance([journey], [step])

      // Act
      registryWithBase.mount(packageInstance)
      const stepRoute = registryWithBase.getTopology().routes.find(route => route.kind === 'step')

      // Assert
      expect(stepRoute?.templatePath).toBe('/forms/journey/step-one')
    })
  })

  describe('getRuntime()', () => {
    it('should expose mounted artefacts and route tree roots when a package is mounted', () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:1', '/journey', ['compile_ast:1'], 'test')
      const step = createStepDescriptor('compile_ast:2', '/step-one', ['compile_ast:1'])
      const packageInstance = createPackageInstance([journey], [step])

      // Act
      registry.mount(packageInstance)
      const runtime = registry.getRuntime()

      // Assert
      expect(runtime.routeTreeRoots).toHaveLength(1)
      expect(runtime.mounts).toHaveLength(1)
      expect(runtime.mounts[0]).toMatchObject({
        journeyCode: 'test-journey',
        packageInstance,
        dependencies: mockPackageDependencies,
      })
      expect(runtime.mounts[0].stepContexts).toHaveLength(1)
      expect(runtime.mounts[0].journeyContexts).toHaveLength(1)
    })
  })
})
