import { subscribe, unsubscribe } from 'node:diagnostics_channel'
import { CompileAstNodeId, NodeId } from './contracts/ast/ast.type'
import { PackageDependencies } from './contracts/ast/engine.type'
import type { RouteDescriptor } from './contracts/routing/routeDescriptors.type'
import type { CompiledJourney, CompiledStep } from './contracts/plans/compilationArtefacts.type'
import type { RequestSnapshot } from '../framework/types/snapshot.type'
import type { RequestTraceEvent } from '../framework/types/traceObserver.type'
import type { ForgeRenderer } from '../framework/rendering/types'
import type PackageInstance from './PackageInstance'
import MountRegistry from './runtime/routes/MountRegistry'
import type Forge from './Forge'
import ForgeOrchestrator from './ForgeOrchestrator'
import { FORGE_REQUEST_COMPLETE_CHANNEL } from './runtime/pipeline/trace/channelTraceObserver'

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

  function createCompiledStep(descriptor: RouteDescriptor, overrides?: Partial<CompiledStep>): CompiledStep {
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
      ...overrides,
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
    compiledStepOverrides?: Partial<CompiledStep>,
  ): Mocked<PackageInstance> {
    const compiledSteps = new Map<NodeId, CompiledStep>(
      steps.map(step => [step.nodeId, createCompiledStep(step, compiledStepOverrides)]),
    )
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
      getJourneyTitle: vi.fn().mockReturnValue(`Journey ${journeyCode}`),
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
      const orchestrator = new ForgeOrchestrator({ core: createForgeStub(registry) })

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
      const orchestrator = new ForgeOrchestrator({ core: createForgeStub(registry) })
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
      const orchestrator = new ForgeOrchestrator({ core: createForgeStub(registry) })
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
      const orchestrator = new ForgeOrchestrator({ core: createForgeStub(registry), renderer })
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
      const orchestrator = new ForgeOrchestrator({ core: createForgeStub(registry) })

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
      const orchestrator = new ForgeOrchestrator({ core: createForgeStub(registry) })
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
      const orchestrator = new ForgeOrchestrator({ core: createForgeStub(registry) })

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

  describe('evaluate() tracing', () => {
    function mountStep(compiledStepOverrides?: Partial<CompiledStep>): void {
      const journey = createJourneyDescriptor('compile_ast:3', '/journey', ['compile_ast:3'], 'test')
      const step = createStepDescriptor('compile_ast:4', '/step-one', ['compile_ast:3'])
      registry.mount(createPackageInstance([journey], [step], 'test-journey', compiledStepOverrides))
    }

    function createTraceObserver(shouldTrace: boolean) {
      return {
        shouldTrace: vi.fn<(snapshot: RequestSnapshot) => boolean>().mockReturnValue(shouldTrace),
        onTrace: vi.fn<(event: RequestTraceEvent) => void>(),
      }
    }

    it('should not record a trace when the observer declines the request', async () => {
      // Arrange
      mountStep()
      const traceObserver = createTraceObserver(false)
      const orchestrator = new ForgeOrchestrator({ core: createForgeStub(registry), traceObserver })
      const stepRoute = orchestrator.getTopology().routes.find(r => r.kind === 'step')!

      // Act
      await orchestrator.evaluate(buildSnapshot(stepRoute.nodeId, 'GET'))
      await orchestrator.evaluate(buildSnapshot(stepRoute.nodeId, 'GET'))

      // Assert
      expect(traceObserver.shouldTrace).toHaveBeenCalledTimes(2)
      expect(traceObserver.onTrace).not.toHaveBeenCalled()
    })

    it('should emit a render trace with phases when the observer accepts a GET request', async () => {
      // Arrange
      mountStep()
      const traceObserver = createTraceObserver(true)
      const orchestrator = new ForgeOrchestrator({ core: createForgeStub(registry), traceObserver })
      const stepRoute = orchestrator.getTopology().routes.find(r => r.kind === 'step')!
      const snapshot = buildSnapshot(stepRoute.nodeId, 'GET')

      // Act
      const outcome = await orchestrator.evaluate(snapshot)

      // Assert
      expect(outcome.kind).toBe('render')
      expect(traceObserver.onTrace).toHaveBeenCalledTimes(1)
      const event = traceObserver.onTrace.mock.calls[0][0]
      expect(event.snapshot).toBe(snapshot)
      expect(event.trace.outcome).toBe('render')
      expect(event.trace.phases.length).toBeGreaterThan(0)
      expect(event.trace.durationMs).toBeGreaterThanOrEqual(0)
      expect(event.trace.phases[0].units).toContainEqual(
        expect.objectContaining({ kind: 'context-snapshot', point: 'initial' }),
      )
    })

    it('should emit a redirect trace when an access hook redirects', async () => {
      // Arrange
      mountStep({
        accessLifecyclePlan: {
          accessHooks: [
            {
              nodeId: 'compile_ast:99',
              evaluate: vi.fn().mockResolvedValue({ executed: true, outcome: 'redirect', redirect: '/elsewhere' }),
            },
          ],
        },
      })
      const traceObserver = createTraceObserver(true)
      const orchestrator = new ForgeOrchestrator({ core: createForgeStub(registry), traceObserver })
      const stepRoute = orchestrator.getTopology().routes.find(r => r.kind === 'step')!

      // Act
      const outcome = await orchestrator.evaluate(buildSnapshot(stepRoute.nodeId, 'GET'))

      // Assert
      expect(outcome.kind).toBe('navigate')
      expect(traceObserver.onTrace).toHaveBeenCalledTimes(1)
      expect(traceObserver.onTrace.mock.calls[0][0].trace.outcome).toBe('redirect')
    })

    it('should emit an error trace and return an error outcome when an access hook halts with an error', async () => {
      // Arrange
      mountStep({
        accessLifecyclePlan: {
          accessHooks: [
            {
              nodeId: 'compile_ast:99',
              evaluate: vi.fn().mockResolvedValue({ executed: true, outcome: 'error', status: 403, message: 'denied' }),
            },
          ],
        },
      })
      const traceObserver = createTraceObserver(true)
      const orchestrator = new ForgeOrchestrator({ core: createForgeStub(registry), traceObserver })
      const stepRoute = orchestrator.getTopology().routes.find(r => r.kind === 'step')!

      // Act
      const outcome = await orchestrator.evaluate(buildSnapshot(stepRoute.nodeId, 'GET'))

      // Assert
      expect(outcome).toEqual(expect.objectContaining({ kind: 'error', error: { status: 403, message: 'denied' } }))
      expect(traceObserver.onTrace).toHaveBeenCalledTimes(1)
      expect(traceObserver.onTrace.mock.calls[0][0].trace.outcome).toBe('error')
    })

    it('should publish on the diagnostics channel when no observer is configured and a subscriber is attached', async () => {
      // Arrange
      mountStep()
      const channelListener = vi.fn()
      subscribe(FORGE_REQUEST_COMPLETE_CHANNEL, channelListener)
      const orchestrator = new ForgeOrchestrator({ core: createForgeStub(registry) })
      const stepRoute = orchestrator.getTopology().routes.find(r => r.kind === 'step')!

      try {
        // Act
        const outcome = await orchestrator.evaluate(buildSnapshot(stepRoute.nodeId, 'GET'))

        // Assert
        expect(outcome.kind).toBe('render')
        expect(channelListener).toHaveBeenCalledTimes(1)
        expect(channelListener).toHaveBeenCalledWith(
          expect.objectContaining({ trace: expect.objectContaining({ outcome: 'render' }) }),
          FORGE_REQUEST_COMPLETE_CHANNEL,
        )
      } finally {
        unsubscribe(FORGE_REQUEST_COMPLETE_CHANNEL, channelListener)
      }
    })

    it.each(['off', false] as const)('should never trace when the trace observer is %s', async traceObserver => {
      // Arrange
      mountStep()
      const channelListener = vi.fn()
      subscribe(FORGE_REQUEST_COMPLETE_CHANNEL, channelListener)
      const orchestrator = new ForgeOrchestrator({ core: createForgeStub(registry), traceObserver })
      const stepRoute = orchestrator.getTopology().routes.find(r => r.kind === 'step')!

      try {
        // Act
        const outcome = await orchestrator.evaluate(buildSnapshot(stepRoute.nodeId, 'GET'))

        // Assert
        expect(outcome.kind).toBe('render')
        expect(channelListener).not.toHaveBeenCalled()
      } finally {
        unsubscribe(FORGE_REQUEST_COMPLETE_CHANNEL, channelListener)
      }
    })

    it('should not consult the observer when the node is unknown', async () => {
      // Arrange
      mountStep()
      const traceObserver = createTraceObserver(true)
      const orchestrator = new ForgeOrchestrator({ core: createForgeStub(registry), traceObserver })

      // Act
      const outcome = await orchestrator.evaluate(buildSnapshot('compile_ast:999', 'GET'))

      // Assert
      expect(outcome.kind).toBe('error')
      expect(traceObserver.shouldTrace).not.toHaveBeenCalled()
      expect(traceObserver.onTrace).not.toHaveBeenCalled()
    })
  })
})
