import { CompileAstNodeId, NodeId } from './contracts/ast/ast.type'
import { PackageDependencies } from './contracts/ast/engine.type'
import type { RouteDescriptor } from './contracts/routing/routeDescriptors.type'
import type { CompiledJourney, CompiledStep } from './contracts/plans/compilationArtefacts.type'
import type { RequestSnapshot } from '../framework/types/snapshot.type'
import type { ForgeRenderer } from '../framework/rendering/types'
import type PackageInstance from './PackageInstance'
import MountRegistry from './runtime/routes/MountRegistry'
import type Forge from './Forge'
import ForgeOrchestrator from './ForgeOrchestrator'

describe('ForgeOrchestrator', () => {
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
      answerPreparationPlan: { fieldAnswerPreparations: [], iteratorAnswerPreparationGroups: [] },
      renderPlan: { renderBlocks: [], iteratorRenderBlockGroups: [] },
      submitLifecyclePlan: { submitHooks: [] },
      entryValidationPlan: { entryValidationRules: [] },
      validationPlan: { fieldValidations: [], iteratorValidationGroups: [] },
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
      answerPreparationPlan: { fieldAnswerPreparations: [], iteratorAnswerPreparationGroups: [] },
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

  function createForgeStub(mountRegistry: MountRegistry): Forge {
    return {
      getRuntime: () => mountRegistry.getRuntime(),
      getTopology: () => mountRegistry.getTopology(),
    } as unknown as Forge
  }

  function buildSnapshot(nodeId: string, method: 'GET' | 'POST'): RequestSnapshot {
    return {
      nodeId,
      method,
      location: {
        origin: 'http://localhost',
        href: `http://localhost/journey/step-one`,
        pathname: '/journey/step-one',
        basePath: '/journey',
      },
      params: {},
      query: {},
      post: {},
      headers: {},
      cookies: {},
      state: {},
      session: undefined,
    }
  }

  describe('getTopology()', () => {
    it('should delegate to the forge topology', () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:1', '/journey', ['compile_ast:1'], 'test')
      const step = createStepDescriptor('compile_ast:2', '/step-one', ['compile_ast:1'])
      registry.mount(createPackageInstance([journey], [step]))
      const orchestrator = new ForgeOrchestrator(createForgeStub(registry))

      // Act
      const topology = orchestrator.getTopology()

      // Assert
      expect(topology).toEqual(registry.getTopology())
    })
  })

  describe('evaluate()', () => {
    it('should render when a step is evaluated with GET', async () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:3', '/journey', ['compile_ast:3'], 'test')
      const step = createStepDescriptor('compile_ast:4', '/step-one', ['compile_ast:3'])
      registry.mount(createPackageInstance([journey], [step]))
      const orchestrator = new ForgeOrchestrator(createForgeStub(registry))
      const stepRoute = orchestrator.getTopology().routes.find(r => r.kind === 'step')!

      // Act
      const outcome = await orchestrator.evaluate(buildSnapshot(stepRoute.nodeId, 'GET'))

      // Assert
      expect(outcome.kind).toBe('render')
      if (outcome.kind === 'render') {
        expect(outcome.componentRegistry).toBe(mockPackageDependencies.componentRegistry)
      }
    })

    it('should return a context-only render outcome when no renderer is bound', async () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:3', '/journey', ['compile_ast:3'], 'test')
      const step = createStepDescriptor('compile_ast:4', '/step-one', ['compile_ast:3'])
      registry.mount(createPackageInstance([journey], [step]))
      const orchestrator = new ForgeOrchestrator(createForgeStub(registry))
      const stepRoute = orchestrator.getTopology().routes.find(r => r.kind === 'step')!

      // Act
      const outcome = await orchestrator.evaluate(buildSnapshot(stepRoute.nodeId, 'GET'))

      // Assert
      expect(outcome).toEqual(expect.objectContaining({ kind: 'render', output: undefined, renderedBlocks: [] }))
    })

    it('should carry the renderer output and rendered blocks on a render outcome', async () => {
      // Arrange
      const renderer: ForgeRenderer<string> = {
        renderBlock: vi.fn((entry, block) => entry.render(block) as string),
        wrapNestedBlock: vi.fn(),
        assemblePage: vi.fn().mockReturnValue('<html>page</html>'),
      }
      const journey = createJourneyDescriptor('compile_ast:3', '/journey', ['compile_ast:3'], 'test')
      const step = createStepDescriptor('compile_ast:4', '/step-one', ['compile_ast:3'])
      registry.mount(createPackageInstance([journey], [step]))
      const orchestrator = new ForgeOrchestrator(createForgeStub(registry), renderer)
      const stepRoute = orchestrator.getTopology().routes.find(r => r.kind === 'step')!

      // Act
      const outcome = await orchestrator.evaluate(buildSnapshot(stepRoute.nodeId, 'GET'))

      // Assert
      expect(renderer.assemblePage).toHaveBeenCalled()
      expect(outcome).toEqual(
        expect.objectContaining({ kind: 'render', output: '<html>page</html>', renderedBlocks: [] }),
      )
    })

    it('should return a node-not-found error outcome for an unknown node', async () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:3', '/journey', ['compile_ast:3'], 'test')
      const step = createStepDescriptor('compile_ast:4', '/step-one', ['compile_ast:3'])
      registry.mount(createPackageInstance([journey], [step]))
      const orchestrator = new ForgeOrchestrator(createForgeStub(registry))

      // Act
      const outcome = await orchestrator.evaluate(buildSnapshot('compile_ast:999', 'GET'))

      // Assert
      expect(outcome).toEqual(
        expect.objectContaining({ kind: 'error', error: expect.objectContaining({ code: 'node-not-found' }) }),
      )
    })

    it('should return a method-not-supported error outcome when a journey root is posted to', async () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:3', '/journey', ['compile_ast:3'], 'test')
      const step = createStepDescriptor('compile_ast:4', '/step-one', ['compile_ast:3'])
      registry.mount(createPackageInstance([journey], [step]))
      const orchestrator = new ForgeOrchestrator(createForgeStub(registry))
      const journeyRoute = orchestrator.getTopology().routes.find(r => r.kind === 'journey')!

      // Act
      const outcome = await orchestrator.evaluate(buildSnapshot(journeyRoute.nodeId, 'POST'))

      // Assert
      expect(outcome).toEqual(
        expect.objectContaining({ kind: 'error', error: expect.objectContaining({ code: 'method-not-supported' }) }),
      )
    })

    it('should not serve nodes mounted after construction', async () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:3', '/journey', ['compile_ast:3'], 'test')
      const step = createStepDescriptor('compile_ast:4', '/step-one', ['compile_ast:3'])
      registry.mount(createPackageInstance([journey], [step]))
      const orchestrator = new ForgeOrchestrator(createForgeStub(registry))

      const lateJourney = createJourneyDescriptor('compile_ast:5', '/late-journey', ['compile_ast:5'], 'late')
      const lateStep = createStepDescriptor('compile_ast:6', '/step-one', ['compile_ast:5'])
      registry.mount(createPackageInstance([lateJourney], [lateStep], 'late-journey'))
      const lateRoute = registry
        .getTopology()
        .routes.find(r => r.nodeId.startsWith('late-journey::') && r.kind === 'step')!

      // Act
      const outcome = await orchestrator.evaluate(buildSnapshot(lateRoute.nodeId, 'GET'))

      // Assert
      expect(outcome).toEqual(
        expect.objectContaining({ kind: 'error', error: expect.objectContaining({ code: 'node-not-found' }) }),
      )
    })
  })
})
