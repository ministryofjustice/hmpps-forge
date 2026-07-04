import type { RequestSnapshot } from '../../../../framework/types/snapshot.type'
import type { RenderContext } from '../../../../framework/rendering/types'
import type { RequestTraceEvent } from '../../../contracts/runtime/trace.type'
import type { RuntimeContext } from '../../../contracts/runtime/evaluationState.type'
import type { ForgeInstrumentation } from '../../../diagnostics/ForgeTraceSinkDispatcher'
import WorkUnit from '../work/WorkUnit'
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

      const root = new WorkUnit('request', 'request.pipeline')
      const phase = new WorkUnit('resolve', 'request.resolve', root)
      const child = new WorkUnit('block', 'resolve.block', phase)
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

      const root = new WorkUnit('request', 'request.pipeline')
      const phase = new WorkUnit('resolve', 'request.resolve', root)
      const child = new WorkUnit('block', 'resolve.block', phase)
      const projector = new RequestPipelineTraceProjector()
      const emitted: RequestTraceEvent[] = []

      root.addChild(phase)
      phase.addChild(child)
      child.complete({ visible: true })

      // Act
      projector.emitFailedTrace(createSnapshot(), createInstrumentation(emitted), root, createRuntimeContext())

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
