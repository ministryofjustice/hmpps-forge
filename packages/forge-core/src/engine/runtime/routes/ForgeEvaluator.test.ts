import { CompileAstNodeId, NodeId } from '../../contracts/ast/ast.type'
import { PackageDependencies } from '../../contracts/ast/engine.type'
import type { JourneyRouteDescriptor, StepRouteDescriptor } from '../../contracts/routing/routeDescriptors.type'
import type { CompiledJourney, CompiledStep } from '../../contracts/plans/compilationArtefacts.type'
import type { RequestSnapshot } from '../../../framework/types/snapshot.type'
import { NO_OP_RESPONSE_BINDINGS } from '../../../framework/types/responseBindings.type'
import DuplicateRouteError from '../../errors/DuplicateRouteError'
import type PackageInstance from '../../PackageInstance'
import ForgeEvaluator from './ForgeEvaluator'

describe('ForgeEvaluator', () => {
  let evaluator: ForgeEvaluator
  let mockPackageDependencies: PackageDependencies

  beforeEach(() => {
    vi.clearAllMocks()

    mockPackageDependencies = {
      componentRegistry: { _id: 'component-registry' } as never,
      functionRegistry: {} as never,
    }

    evaluator = new ForgeEvaluator({})
  })

  function createJourneyDescriptor(
    id: CompileAstNodeId,
    path: string,
    ancestorJourneyNodeIds: readonly NodeId[],
    title = `Journey ${path}`,
  ): JourneyRouteDescriptor {
    return { nodeId: id, path, title, ancestorJourneyNodeIds }
  }

  function createStepDescriptor(
    id: CompileAstNodeId,
    path: string,
    ancestorJourneyNodeIds: readonly NodeId[],
    title = `Step ${path}`,
  ): StepRouteDescriptor {
    return { nodeId: id, path, title, ancestorJourneyNodeIds }
  }

  function createCompiledStep(descriptor: StepRouteDescriptor): CompiledStep {
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
        stepValidationPlans: new Map(),
      },
      answerPreparationPlan: { fieldAnswerPreparations: [], iteratorAnswerPreparationGroups: [] },
      renderPlan: { renderBlocks: [], iteratorRenderBlockGroups: [] },
      submitLifecyclePlan: { submitHooks: [] },
      entryValidationPlan: { entryValidationRules: [] },
      validationPlan: { fieldValidations: [], iteratorValidationGroups: [] },
    }
  }

  function createCompiledJourney(descriptor: JourneyRouteDescriptor): CompiledJourney {
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
        stepValidationPlans: new Map(),
      },
      answerPreparationPlan: { fieldAnswerPreparations: [], iteratorAnswerPreparationGroups: [] },
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
      getCompiledStep: vi.fn((stepNodeId: NodeId) => compiledSteps.get(stepNodeId)),
      getCompiledJourney: vi.fn((journeyNodeId: NodeId) => compiledJourneys.get(journeyNodeId)),
      getJourneyCode: vi.fn().mockReturnValue('test-journey'),
    } as unknown as Mocked<PackageInstance>
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

  describe('mount()', () => {
    it('should return the count of registered routes', () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:1', '/journey', ['compile_ast:1'], 'test')
      const step = createStepDescriptor('compile_ast:2', '/step-one', ['compile_ast:1'])
      const packageInstance = createPackageInstance([journey], [step])

      // Act
      const routeCount = evaluator.mount(packageInstance)

      // Assert
      expect(routeCount).toBe(3)
    })

    it('should throw DuplicateRouteError when two concrete routes share a URL template', () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:10', '/journey', ['compile_ast:10'], 'test')
      const step1 = createStepDescriptor('compile_ast:11', '/same-path', ['compile_ast:10'])
      const step2 = createStepDescriptor('compile_ast:12', '/same-path', ['compile_ast:10'])
      const packageInstance = createPackageInstance([journey], [step1, step2])

      // Act & Assert
      expect(() => evaluator.mount(packageInstance)).toThrow(DuplicateRouteError)
    })
  })

  describe('getTopology()', () => {
    it('should expose a step route (GET + POST) and a journey route (GET) as data', () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:1', '/journey', ['compile_ast:1'], 'My Journey')
      const step = createStepDescriptor('compile_ast:2', '/step-one', ['compile_ast:1'], 'Step One')
      const packageInstance = createPackageInstance([journey], [step])

      // Act
      evaluator.mount(packageInstance)
      const { routes } = evaluator.getTopology()

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
      evaluator.mount(packageInstance)
      const stepRoute = evaluator.getTopology().routes.find(route => route.kind === 'step')

      // Assert
      expect(stepRoute).toMatchObject({
        templatePath: '/journey/section/details',
        basePath: '/journey/section',
        methods: ['GET', 'POST'],
      })
    })

    it('should include the configured base path in template paths', () => {
      // Arrange
      const evaluatorWithBase = new ForgeEvaluator({ basePath: '/forms' })
      const journey = createJourneyDescriptor('compile_ast:8', '/journey', ['compile_ast:8'], 'test')
      const step = createStepDescriptor('compile_ast:9', '/step-one', ['compile_ast:8'])
      const packageInstance = createPackageInstance([journey], [step])

      // Act
      evaluatorWithBase.mount(packageInstance)
      const stepRoute = evaluatorWithBase.getTopology().routes.find(route => route.kind === 'step')

      // Assert
      expect(stepRoute?.templatePath).toBe('/forms/journey/step-one')
    })
  })

  describe('evaluate()', () => {
    it('should render when a step is evaluated with GET', async () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:3', '/journey', ['compile_ast:3'], 'test')
      const step = createStepDescriptor('compile_ast:4', '/step-one', ['compile_ast:3'])
      const packageInstance = createPackageInstance([journey], [step])
      evaluator.mount(packageInstance)
      const stepRoute = evaluator.getTopology().routes.find(r => r.kind === 'step')!

      // Act
      const outcome = await evaluator.evaluate(buildSnapshot(stepRoute.nodeId, 'GET'), NO_OP_RESPONSE_BINDINGS)

      // Assert
      expect(outcome.kind).toBe('render')
      if (outcome.kind === 'render') {
        expect(outcome.componentRegistry).toBe(mockPackageDependencies.componentRegistry)
      }
    })

    it('should return a node-not-found error outcome for an unknown node', async () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:3', '/journey', ['compile_ast:3'], 'test')
      const step = createStepDescriptor('compile_ast:4', '/step-one', ['compile_ast:3'])
      evaluator.mount(createPackageInstance([journey], [step]))

      // Act
      const outcome = await evaluator.evaluate(buildSnapshot('compile_ast:999', 'GET'), NO_OP_RESPONSE_BINDINGS)

      // Assert
      expect(outcome).toEqual(
        expect.objectContaining({ kind: 'error', error: expect.objectContaining({ code: 'node-not-found' }) }),
      )
    })

    it('should return a method-not-supported error outcome when a journey root is posted to', async () => {
      // Arrange
      const journey = createJourneyDescriptor('compile_ast:3', '/journey', ['compile_ast:3'], 'test')
      const step = createStepDescriptor('compile_ast:4', '/step-one', ['compile_ast:3'])
      evaluator.mount(createPackageInstance([journey], [step]))
      const journeyRoute = evaluator.getTopology().routes.find(r => r.kind === 'journey')!

      // Act
      const outcome = await evaluator.evaluate(buildSnapshot(journeyRoute.nodeId, 'POST'), NO_OP_RESPONSE_BINDINGS)

      // Assert
      expect(outcome).toEqual(
        expect.objectContaining({ kind: 'error', error: expect.objectContaining({ code: 'method-not-supported' }) }),
      )
    })
  })
})
