import type { RequestSnapshot } from '../../../../framework/types/snapshot.type'
import type { RenderContext, RouteTree } from '../../../../framework/rendering/types'
import type { RequestTraceEvent } from '../../../contracts/runtime/trace.type'
import type { RuntimeContext } from '../../../contracts/runtime/evaluationState.type'
import type { MountedNode } from '../../../registries/MountRegistry'
import type { ForgeInstrumentation } from '../../../diagnostics/ForgeTraceSinkDispatcher'
import TraceSpan from '../../../diagnostics/tracing/TraceSpan'
import type { ContextSnapshotData } from '../work/tracing/contextSnapshot'
import RequestPipelineTraceProjector from './RequestPipelineTraceProjector'

describe('RequestPipelineTraceProjector', () => {
  describe('emitTrace()', () => {
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
      projector.emitTrace(
        createSnapshot(),
        createInstrumentation(emitted),
        {
          kind: 'render',
          context: createRenderContext(),
        },
        root,
        createMountedNode(),
        undefined,
      )

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
      projector.emitFailedTrace(
        createSnapshot(),
        createInstrumentation(emitted),
        new Error('boom'),
        root,
        createRuntimeContext(),
        createMountedNode(),
        undefined,
      )

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
      projector.emitTrace(
        createSnapshot(),
        createInstrumentation(emitted),
        { kind: 'redirect', target: '/journey/next' },
        root,
        createMountedNode(),
        undefined,
      )

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
      projector.emitTrace(
        createSnapshot(),
        createInstrumentation(emitted),
        { kind: 'error', status: 403, message: 'Forbidden' },
        root,
        createMountedNode(),
        undefined,
      )

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
      projector.emitFailedTrace(
        createSnapshot(),
        createInstrumentation(emitted),
        thrown,
        root,
        createRuntimeContext(),
        createMountedNode(),
        undefined,
      )

      // Assert
      expect(emitted[0].trace.error).toEqual({ message: 'handler exploded', stack: thrown.stack })
    })

    it('should stringify the thrown value when a failed trace is thrown from a non-Error', () => {
      // Arrange
      const root = new TraceSpan('request', 'request.pipeline')
      const phase = new TraceSpan('resolve', 'request.resolve', root)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []

      root.addChild(phase)

      // Act
      projector.emitFailedTrace(
        createSnapshot(),
        createInstrumentation(emitted),
        'catastrophic failure',
        root,
        createRuntimeContext(),
        createMountedNode(),
        undefined,
      )

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
      projector.emitTrace(
        createSnapshot(),
        createInstrumentation(emitted),
        { kind: 'render', context: createRenderContext() },
        root,
        createMountedNode(),
        undefined,
      )

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
      projector.emitTrace(
        createSnapshot(),
        createInstrumentation(emitted),
        { kind: 'render', context: createRenderContext() },
        root,
        createMountedNode(),
        createRouteTree(),
      )

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
      projector.emitFailedTrace(
        createSnapshot(),
        createInstrumentation(emitted),
        new Error('boom'),
        root,
        createRuntimeContext(),
        createMountedNode(),
        undefined,
      )

      // Assert
      expect(emitted[0].route).toEqual({
        journeyCode: 'journey',
        routeTemplatePath: '/journey/step',
        journeyTitle: undefined,
        stepTitle: undefined,
      })
    })
  })
})

function createInstrumentation(emitted: RequestTraceEvent[]): ForgeInstrumentation {
  return {
    enabled: true,
    onRequestTrace: event => {
      emitted.push(event)
    },
  }
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
