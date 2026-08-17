import type { RequestSnapshot } from '../../../framework/types/snapshot.type'
import type { RenderContext } from '../../../framework/types/rendering.type'
import type { RouteTree } from '../../../framework/types/routeTree.type'
import type { RequestTraceEvent } from '../../contracts/runtime/trace.type'
import type { ReachabilityEvaluation } from '../../concerns/reachability/contracts/reachabilityEvaluation.type'
import type { RuntimeContext } from '../../contracts/runtime/evaluationState.type'
import type { MountedNode } from '../../registries/MountRegistry'
import type { ForgeInstrumentation } from '../../tracing/ForgeTraceSinkDispatcher'
import TraceSpan from '../../tracing/TraceSpan'
import type { ContextSnapshotData } from './contextSnapshot'
import RequestPipelineTraceProjector from './RequestPipelineTraceProjector'

describe('RequestPipelineTraceProjector', () => {
  describe('emit()', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should emit request and phase timing from parent work units', () => {
      // Arrange
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(20)
        .mockReturnValueOnce(30)
        .mockReturnValueOnce(40)
        .mockReturnValueOnce(50)

      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const child = new TraceSpan('block', 'resolve.block', phase)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []

      root.addChild(phase)
      phase.addChild(child)
      child.complete({ visible: true })
      phase.recordTraceMetadataAtFinish(createContextSnapshot())
      phase.complete({ action: 'continue' })
      root.complete({ kind: 'render', context: createRenderContext() })

      // Act
      projector.emit({
        snapshot: createSnapshot(),
        instrumentation: createInstrumentation(emitted),
        result: {
          kind: 'render',
          context: createRenderContext(),
        },
        root,
        node: createMountedNode(),
        routeTree: undefined,
        reachabilityEvaluation: undefined,
      })

      // Assert
      expect(emitted).toHaveLength(1)
      expect(emitted[0].trace).toMatchObject({
        outcome: 'render',
        startedAtMs: 0,
        completedAtMs: 50,
        durationMs: 50,
        phases: [
          {
            phase: 'resolve',
            startedAtMs: 10,
            completedAtMs: 40,
            durationMs: 30,
            units: [
              {
                key: 'block',
                kind: 'resolve.block',
                startedAtMs: 20,
                completedAtMs: 30,
                durationMs: 10,
              },
              {
                key: 'after-resolve',
                kind: 'context-snapshot',
              },
            ],
          },
        ],
      })
    })

    it('should emit available timing for failed traces with incomplete work units', () => {
      // Arrange
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(20)
        .mockReturnValueOnce(30)

      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const child = new TraceSpan('block', 'resolve.block', phase)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []

      root.addChild(phase)
      phase.addChild(child)
      child.complete({ visible: true })

      // Act
      projector.emitFailed({
        snapshot: createSnapshot(),
        instrumentation: createInstrumentation(emitted),
        error: new Error('boom'),
        root,
        context: createRuntimeContext(),
        node: createMountedNode(),
        routeTree: undefined,
        reachabilityEvaluation: undefined,
      })

      // Assert
      expect(emitted).toHaveLength(1)
      expect(emitted[0].trace).toMatchObject({
        outcome: 'error',
        startedAtMs: 0,
        completedAtMs: undefined,
        durationMs: undefined,
        phases: [
          {
            phase: 'resolve',
            startedAtMs: 10,
            completedAtMs: undefined,
            durationMs: undefined,
            units: [
              {
                key: 'block',
                kind: 'resolve.block',
                startedAtMs: 20,
                completedAtMs: 30,
                durationMs: 10,
              },
              {
                key: 'after-resolve',
                kind: 'context-snapshot',
              },
            ],
          },
        ],
      })
    })

    it('should carry the redirect target when the pipeline result is a redirect', () => {
      // Arrange
      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []

      root.addChild(phase)
      phase.complete({ action: 'continue' })
      root.complete({ kind: 'redirect', target: '/journey/next' })

      // Act
      projector.emit({
        snapshot: createSnapshot(),
        instrumentation: createInstrumentation(emitted),
        result: { kind: 'redirect', target: '/journey/next' },
        root,
        node: createMountedNode(),
        routeTree: undefined,
        reachabilityEvaluation: undefined,
      })

      // Assert
      expect(emitted[0].trace.outcome).toBe('redirect')
      expect(emitted[0].trace.redirect).toEqual({ target: '/journey/next' })
    })

    it('should carry the status and message when the pipeline result is a halt error', () => {
      // Arrange
      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []

      root.addChild(phase)
      phase.complete({ action: 'continue' })
      root.complete({ kind: 'error', status: 403, message: 'Forbidden' })

      // Act
      projector.emit({
        snapshot: createSnapshot(),
        instrumentation: createInstrumentation(emitted),
        result: { kind: 'error', status: 403, message: 'Forbidden' },
        root,
        node: createMountedNode(),
        routeTree: undefined,
        reachabilityEvaluation: undefined,
      })

      // Assert
      expect(emitted[0].trace.outcome).toBe('error')
      expect(emitted[0].trace.error).toEqual({ status: 403, message: 'Forbidden' })
    })

    it('should carry the message and stack when a failed trace is thrown from an Error', () => {
      // Arrange
      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []
      const thrown = new Error('handler exploded')

      root.addChild(phase)

      // Act
      projector.emitFailed({
        snapshot: createSnapshot(),
        instrumentation: createInstrumentation(emitted),
        error: thrown,
        root,
        context: createRuntimeContext(),
        node: createMountedNode(),
        routeTree: undefined,
        reachabilityEvaluation: undefined,
      })

      // Assert
      expect(emitted[0].trace.error).toEqual({ message: 'handler exploded', stack: thrown.stack })
    })

    it('should carry status when a failed trace is thrown from an HTTP Error', () => {
      // Arrange
      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []
      const thrown = Object.assign(new Error('Missing'), { status: 404, statusCode: 409 })

      root.addChild(phase)

      // Act
      projector.emitFailed({
        snapshot: createSnapshot(),
        instrumentation: createInstrumentation(emitted),
        error: thrown,
        root,
        context: createRuntimeContext(),
        node: createMountedNode(),
        routeTree: undefined,
        reachabilityEvaluation: undefined,
      })

      // Assert
      expect(emitted[0].trace.error).toEqual({ message: 'Missing', stack: thrown.stack, status: 404 })
    })

    it('should carry statusCode when a failed trace Error has no status', () => {
      // Arrange
      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []
      const thrown = Object.assign(new Error('Unavailable'), { statusCode: 503 })

      root.addChild(phase)

      // Act
      projector.emitFailed({
        snapshot: createSnapshot(),
        instrumentation: createInstrumentation(emitted),
        error: thrown,
        root,
        context: createRuntimeContext(),
        node: createMountedNode(),
        routeTree: undefined,
        reachabilityEvaluation: undefined,
      })

      // Assert
      expect(emitted[0].trace.error).toEqual({ message: 'Unavailable', stack: thrown.stack, status: 503 })
    })

    it('should stringify the thrown value when a failed trace is thrown from a non-Error', () => {
      // Arrange
      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []

      root.addChild(phase)

      // Act
      projector.emitFailed({
        snapshot: createSnapshot(),
        instrumentation: createInstrumentation(emitted),
        error: 'catastrophic failure',
        root,
        context: createRuntimeContext(),
        node: createMountedNode(),
        routeTree: undefined,
        reachabilityEvaluation: undefined,
      })

      // Assert
      expect(emitted[0].trace.error).toEqual({ message: 'catastrophic failure' })
    })

    it('should carry the static route block without titles when there is no hydrated route tree', () => {
      // Arrange
      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []

      root.addChild(phase)
      phase.complete({ action: 'continue' })
      root.complete({ kind: 'render', context: createRenderContext() })

      // Act
      projector.emit({
        snapshot: createSnapshot(),
        instrumentation: createInstrumentation(emitted),
        result: { kind: 'render', context: createRenderContext() },
        root,
        node: createMountedNode(),
        routeTree: undefined,
        reachabilityEvaluation: undefined,
      })

      // Assert
      expect(emitted[0].route).toEqual({
        journeyCode: 'journey',
        routeTemplatePath: '/journey/step',
        journeyTitle: undefined,
        stepTitle: undefined,
      })
    })

    it('should populate journey and step titles from the hydrated route tree when present', () => {
      // Arrange
      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []

      root.addChild(phase)
      phase.complete({ action: 'continue' })
      root.complete({ kind: 'render', context: createRenderContext() })

      // Act
      projector.emit({
        snapshot: createSnapshot(),
        instrumentation: createInstrumentation(emitted),
        result: { kind: 'render', context: createRenderContext() },
        root,
        node: createMountedNode(),
        routeTree: createRouteTree(),
        reachabilityEvaluation: undefined,
      })

      // Assert
      expect(emitted[0].route).toEqual({
        journeyCode: 'journey',
        routeTemplatePath: '/journey/step',
        journeyTitle: 'Apply for something',
        stepTitle: 'Your details',
      })
    })

    it('should carry the static route block without titles when emitting a failed trace', () => {
      // Arrange
      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []

      root.addChild(phase)

      // Act
      projector.emitFailed({
        snapshot: createSnapshot(),
        instrumentation: createInstrumentation(emitted),
        error: new Error('boom'),
        root,
        context: createRuntimeContext(),
        node: createMountedNode(),
        routeTree: undefined,
        reachabilityEvaluation: undefined,
      })

      // Assert
      expect(emitted[0].route).toEqual({
        journeyCode: 'journey',
        routeTemplatePath: '/journey/step',
        journeyTitle: undefined,
        stepTitle: undefined,
      })
    })

    it('should carry the projected reachability evaluation when the pipeline provides one', () => {
      // Arrange
      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []

      root.addChild(phase)
      phase.complete({ action: 'continue' })
      root.complete({ kind: 'render', context: createRenderContext() })

      // Act
      projector.emit({
        snapshot: createSnapshot(),
        instrumentation: createInstrumentation(emitted),
        result: { kind: 'render', context: createRenderContext() },
        root,
        node: createMountedNode(),
        routeTree: undefined,
        reachabilityEvaluation: createReachabilityEvaluation(),
      })

      // Assert
      expect(emitted[0].trace.reachability).toEqual({
        currentStepId: 'compile_ast:2',
        steps: [
          {
            stepId: 'compile_ast:2',
            routeTemplatePath: '/journey/step',
            code: 'step',
            declarationIndex: 0,
            isEntryPoint: true,
            isConditionalEntry: false,
            hasValidation: true,
            isReachable: true,
            isValid: true,
            forwardRouteTemplatePaths: ['/journey/next'],
            declaredForwardRouteTemplatePaths: ['/journey/next'],
            predecessorRouteTemplatePaths: [],
            tieBreakerPriority: 0,
          },
        ],
        defaultEntryRouteTemplatePath: '/journey/step',
        frontierRouteTemplatePath: '/journey/step',
        canonicalPathRouteTemplatePaths: ['/journey/step'],
        progressExists: true,
        resumeActive: false,
        resumeOutcome: 'no-op',
        unreachableRedirect: 'entry',
      })
    })

    it('should copy reachability arrays so the trace does not alias the live evaluation', () => {
      // Arrange
      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []
      const evaluation = createReachabilityEvaluation()

      root.addChild(phase)
      phase.complete({ action: 'continue' })
      root.complete({ kind: 'render', context: createRenderContext() })

      // Act
      projector.emit({
        snapshot: createSnapshot(),
        instrumentation: createInstrumentation(emitted),
        result: { kind: 'render', context: createRenderContext() },
        root,
        node: createMountedNode(),
        routeTree: undefined,
        reachabilityEvaluation: evaluation,
      })

      // Assert
      const { reachability } = emitted[0].trace
      expect(reachability?.steps[0].forwardRouteTemplatePaths).not.toBe(evaluation.steps[0].forwardRouteTemplatePaths)
      expect(reachability?.steps[0].forwardRouteTemplatePaths).toEqual(evaluation.steps[0].forwardRouteTemplatePaths)
      expect(reachability?.canonicalPathRouteTemplatePaths).not.toBe(evaluation.canonicalPathRouteTemplatePaths)
      expect(reachability?.canonicalPathRouteTemplatePaths).toEqual(evaluation.canonicalPathRouteTemplatePaths)
    })

    it('should omit reachability when the pipeline provides no evaluation', () => {
      // Arrange
      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []

      root.addChild(phase)
      phase.complete({ action: 'continue' })
      root.complete({ kind: 'render', context: createRenderContext() })

      // Act
      projector.emit({
        snapshot: createSnapshot(),
        instrumentation: createInstrumentation(emitted),
        result: { kind: 'render', context: createRenderContext() },
        root,
        node: createMountedNode(),
        routeTree: undefined,
        reachabilityEvaluation: undefined,
      })

      // Assert
      expect(emitted[0].trace).not.toHaveProperty('reachability')
    })

    it('should carry the projected reachability evaluation when emitting a failed trace', () => {
      // Arrange
      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []

      root.addChild(phase)

      // Act
      projector.emitFailed({
        snapshot: createSnapshot(),
        instrumentation: createInstrumentation(emitted),
        error: new Error('boom'),
        root,
        context: createRuntimeContext(),
        node: createMountedNode(),
        routeTree: undefined,
        reachabilityEvaluation: createReachabilityEvaluation(),
      })

      // Assert
      expect(emitted[0].trace.reachability).toEqual({
        currentStepId: 'compile_ast:2',
        steps: [
          {
            stepId: 'compile_ast:2',
            routeTemplatePath: '/journey/step',
            code: 'step',
            declarationIndex: 0,
            isEntryPoint: true,
            isConditionalEntry: false,
            hasValidation: true,
            isReachable: true,
            isValid: true,
            forwardRouteTemplatePaths: ['/journey/next'],
            declaredForwardRouteTemplatePaths: ['/journey/next'],
            predecessorRouteTemplatePaths: [],
            tieBreakerPriority: 0,
          },
        ],
        defaultEntryRouteTemplatePath: '/journey/step',
        frontierRouteTemplatePath: '/journey/step',
        canonicalPathRouteTemplatePaths: ['/journey/step'],
        progressExists: true,
        resumeActive: false,
        resumeOutcome: 'no-op',
        unreachableRedirect: 'entry',
      })
    })
  })
})

function createInstrumentation(emitted: RequestTraceEvent[]): ForgeInstrumentation {
  const instrumentation: ForgeInstrumentation = {
    enabled: true,
    forRequest: () => instrumentation,
    onRequestTrace: event => {
      emitted.push(event)
    },
    onCompilationTrace: vi.fn(),
  }

  return instrumentation
}

function createSnapshot(): RequestSnapshot {
  return {
    nodeId: 'node',
    method: 'GET',
    location: {
      origin: 'http://localhost',
      href: 'http://localhost/target',
      pathname: '/target',
      basePath: '',
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

function createRenderContext(): RenderContext {
  return {
    routeTree: [],
    step: { path: '/target' },
    ancestors: [],
    blocks: [],
    showValidationFailures: false,
    fieldValidationErrors: [],
    domainValidationErrors: [],
    answers: {},
    data: {},
  }
}

function createRuntimeContext(): RuntimeContext {
  return {
    request: {
      url: 'http://localhost/target',
      path: '/target',
      method: 'GET',
      location: {
        origin: 'http://localhost',
        href: 'http://localhost/target',
        pathname: '/target',
        basePath: '',
      },
      headers: {},
      cookies: {},
      state: {},
      params: {},
      query: {},
      post: {},
      session: {},
    },
    domain: {
      data: {},
      answers: {},
    },
    evaluation: {},
  }
}

function createContextSnapshot(): ContextSnapshotData {
  return {
    data: {},
    answers: {},
  }
}

// The projector only reads journeyCode/templatePath/nodeId off the node, so stub those and
// widen at the fixture boundary rather than fabricate the full compiled MountedStepNode.
function createMountedNode(): MountedNode {
  return {
    mountKey: 'journey::step',
    kind: 'step',
    nodeId: 'compile_ast:2',
    journeyCode: 'journey',
    templatePath: '/journey/step',
  } as unknown as MountedNode
}

// NodeId is a branded template-literal type; 'compile_ast:2' literals satisfy it like createMountedNode.
function createReachabilityEvaluation(): ReachabilityEvaluation {
  return {
    currentStepId: 'compile_ast:2',
    steps: [
      {
        stepId: 'compile_ast:2',
        routeTemplatePath: '/journey/step',
        code: 'step',
        declarationIndex: 0,
        isEntryPoint: true,
        isConditionalEntry: false,
        hasValidation: true,
        isReachable: true,
        isValid: true,
        forwardRouteTemplatePaths: ['/journey/next'],
        declaredForwardRouteTemplatePaths: ['/journey/next'],
        predecessorRouteTemplatePaths: [],
        tieBreakerPriority: 0,
      },
    ],
    defaultEntryRouteTemplatePath: '/journey/step',
    frontierRouteTemplatePath: '/journey/step',
    canonicalPathRouteTemplatePaths: ['/journey/step'],
    progressExists: true,
    resumeActive: false,
    resumeOutcome: 'no-op',
    unreachableRedirect: 'entry',
  }
}

function createRouteTree(): RouteTree {
  return [
    {
      segment: 'journey',
      path: '/journey',
      templatePath: '/journey',
      active: true,
      route: { kind: 'journey', nodeId: 'compile_ast:1', title: 'Apply for something' },
      children: [
        {
          segment: 'step',
          path: '/journey/step',
          templatePath: '/journey/step',
          active: true,
          route: { kind: 'step', nodeId: 'compile_ast:2', title: 'Your details' },
          children: [],
        },
      ],
    },
  ]
}
