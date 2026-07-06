import type {
  RequestTrace,
  RequestTraceEvent,
  RequestTracePhase,
  RequestTraceUnit,
} from '@ministryofjustice/hmpps-forge/core'
import TraceMessageBuilder from './TraceMessageBuilder'

type SnapshotUnit = Extract<RequestTraceUnit, { readonly kind: 'context-snapshot' }>

interface WorkUnitOptions {
  readonly beginFields?: Record<string, unknown>
  readonly completeFields?: Record<string, unknown>
  readonly startedAtMs?: number
  readonly completedAtMs?: number
  readonly durationMs?: number
  readonly selfDurationMs?: number
  readonly executionSlices?: readonly { readonly startedAtMs: number; readonly completedAtMs: number }[]
}

function workUnit(kind: string, options: WorkUnitOptions = {}): RequestTraceUnit {
  return {
    key: kind,
    kind,
    beginFields: options.beginFields ?? {},
    completeFields: options.completeFields ?? {},
    completed: true,
    startedAtMs: options.startedAtMs ?? 0,
    completedAtMs: options.completedAtMs,
    durationMs: options.durationMs,
    selfDurationMs: options.selfDurationMs,
    executionSlices: options.executionSlices,
    children: [],
  }
}

interface SnapshotOptions {
  readonly key?: string
  readonly answers?: SnapshotUnit['answers']
  readonly data?: SnapshotUnit['data']
  // stepValidities is keyed by the branded NodeId in core, so accept plain string keys here and
  // widen at the fixture boundary rather than fabricate NodeId values.
  readonly stepValidities?: Record<string, unknown>
  readonly reachability?: NonNullable<SnapshotUnit['reachability']>
}

function contextSnapshotUnit(options: SnapshotOptions = {}): RequestTraceUnit {
  return {
    key: options.key ?? 'context-snapshot',
    kind: 'context-snapshot',
    beginFields: {},
    completeFields: {},
    completed: true,
    children: [],
    answers: options.answers ?? {},
    data: options.data ?? {},
    stepValidities: options.stepValidities as SnapshotUnit['stepValidities'],
    reachability: options.reachability,
  }
}

interface TraceOptions {
  readonly outcome?: RequestTrace['outcome']
  readonly startedAtMs?: number
  readonly durationMs?: number
  readonly redirect?: RequestTrace['redirect']
  readonly error?: RequestTrace['error']
  readonly reachability?: RequestTrace['reachability']
}

function eventWithPhases(phases: readonly RequestTracePhase[], trace: TraceOptions = {}): RequestTraceEvent {
  return {
    snapshot: {
      nodeId: 'journey::step',
      method: 'GET',
      location: { origin: 'http://localhost', href: 'http://localhost/step', pathname: '/step', basePath: '' },
      params: { journeyId: 'apply', stepId: 'details' },
      query: { edit: 'true', tags: ['a', 'b'] },
      post: { firstName: 'Ada', agree: true },
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: ['text/html', 'application/xhtml+xml'] },
      cookies: { sessionId: 'abc123' },
      state: { user: { id: 'u-1' }, csrfToken: 'tok' },
      session: { userId: 'u-1' },
    },
    trace: {
      outcome: trace.outcome ?? 'render',
      startedAtMs: trace.startedAtMs ?? 0,
      durationMs: trace.durationMs,
      redirect: trace.redirect,
      error: trace.error,
      reachability: trace.reachability,
      phases,
    },
  }
}

// stepId/currentStepId are the branded NodeId in core, so use 'compile_ast:N' literals that satisfy
// the template-literal type rather than fabricate NodeId values.
function traceReachability(): NonNullable<RequestTrace['reachability']> {
  return {
    currentStepId: 'compile_ast:2',
    steps: [
      {
        stepId: 'compile_ast:2',
        routeTemplatePath: '/step',
        code: 'step',
        declarationIndex: 0,
        isEntryPoint: true,
        isConditionalEntry: false,
        hasValidation: true,
        isReachable: true,
        isValid: true,
        forwardRouteTemplatePaths: ['/next'],
        declaredForwardRouteTemplatePaths: ['/next'],
        predecessorRouteTemplatePaths: [],
        tieBreakerPriority: 0,
      },
      {
        stepId: 'compile_ast:3',
        routeTemplatePath: '/next',
        code: 'next',
        declarationIndex: 1,
        isEntryPoint: false,
        isConditionalEntry: false,
        hasValidation: false,
        isReachable: false,
        isValid: false,
        forwardRouteTemplatePaths: [],
        predecessorRouteTemplatePaths: ['/step'],
      },
    ],
    defaultEntryRouteTemplatePath: '/step',
    frontierRouteTemplatePath: '/step',
    canonicalPathRouteTemplatePaths: ['/step'],
    progressExists: true,
    resumeActive: false,
    resumeOutcome: 'no-op',
    unreachableRedirect: 'entry',
  }
}

function eventWithUnit(unit: RequestTraceUnit): RequestTraceEvent {
  return eventWithPhases([{ phase: 'render', startedAtMs: 0, units: [unit] }])
}

describe('TraceMessageBuilder', () => {
  describe('build()', () => {
    it('should resolve nodeId from id and variant from variant when building a block unit', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const unit = workUnit('resolve.block', {
        beginFields: { id: 'name-block', variant: 'summary', blockType: 'question' },
      })

      // Act
      const message = builder.build(eventWithUnit(unit))

      // Assert
      const built = message.trace.phases[0].units[0]
      expect(built.nodeId).toBe('name-block')
      expect(built.variant).toBe('summary')
    })

    it('should resolve nodeId from currentStepId when building a reachability unit', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const unit = workUnit('reachability.evaluation', {
        beginFields: { currentStepId: 'journey::eligibility' },
      })

      // Act
      const message = builder.build(eventWithUnit(unit))

      // Assert
      expect(message.trace.phases[0].units[0].nodeId).toBe('journey::eligibility')
    })

    it('should resolve variant from outcome when a hook unit has only complete fields', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const unit = workUnit('access.hook', {
        completeFields: { executed: true, outcome: 'allow' },
      })

      // Act
      const message = builder.build(eventWithUnit(unit))

      // Assert
      expect(message.trace.phases[0].units[0].variant).toBe('allow')
    })

    it('should resolve name from code when building an answer preparation field unit', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const unit = workUnit('answer.preparation.field', {
        beginFields: { code: 'firstName', mode: 'edit' },
      })

      // Act
      const message = builder.build(eventWithUnit(unit))

      // Assert
      expect(message.trace.phases[0].units[0].name).toBe('firstName')
    })

    it('should prefer completeFields over beginFields when both define a probed field', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const unit = workUnit('resolve.block', {
        beginFields: { variant: 'begin-variant' },
        completeFields: { variant: 'complete-variant' },
      })

      // Act
      const message = builder.build(eventWithUnit(unit))

      // Assert
      expect(message.trace.phases[0].units[0].variant).toBe('complete-variant')
    })

    it('should forward all snapshot payload sections and the unit key as name when serialising a context-snapshot unit', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const unit = contextSnapshotUnit({
        key: 'after-render',
        answers: { firstName: { current: 'Ada', mutations: [] } },
        data: { referenceNumber: 'ABC123' },
        stepValidities: { 'journey::step': { fieldFailures: [], domainFailures: [] } },
        reachability: { reachableSteps: [{ path: '/step' }], unreachableSteps: [] },
      })

      // Act
      const message = builder.build(eventWithUnit(unit))

      // Assert
      expect(message.trace.phases[0].units[0]).toEqual({
        kind: 'context-snapshot',
        name: 'after-render',
        snapshot: {
          answers: { firstName: { current: 'Ada', mutations: [] } },
          data: { referenceNumber: 'ABC123' },
          stepValidities: { 'journey::step': { fieldFailures: [], domainFailures: [] } },
          reachability: { reachableSteps: [{ path: '/step' }], unreachableSteps: [] },
        },
        children: [],
      })
    })

    it('should forward merged begin and complete fields with completeFields winning when building a work unit', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const unit = workUnit('validation.step', {
        beginFields: { fieldFailures: 2, source: 'begin' },
        completeFields: { source: 'complete', domainFailures: 1 },
      })

      // Act
      const message = builder.build(eventWithUnit(unit))

      // Assert
      expect(message.trace.phases[0].units[0].fields).toEqual({
        fieldFailures: 2,
        source: 'complete',
        domainFailures: 1,
      })
    })

    it('should omit the fields property when a work unit has no begin or complete fields', () => {
      // Arrange
      const builder = new TraceMessageBuilder()

      // Act
      const message = builder.build(eventWithUnit(workUnit('render.render-blocks')))

      // Assert
      expect(message.trace.phases[0].units[0]).not.toHaveProperty('fields')
    })

    it('should surface materialised block properties as a top-level field when the unit fields carry them', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const unit = workUnit('resolve.block', {
        beginFields: { id: 'name-block', variant: 'summary' },
        completeFields: { visible: true, properties: { html: '<p>Hi</p>', visibleWhen: true } },
      })

      // Act
      const message = builder.build(eventWithUnit(unit))

      // Assert
      const built = message.trace.phases[0].units[0]
      expect(built.properties).toEqual({ html: '<p>Hi</p>', visibleWhen: true })
      expect(built.fields).toEqual({ id: 'name-block', variant: 'summary', visible: true })
    })

    it('should omit the properties field when the unit fields carry no properties', () => {
      // Arrange
      const builder = new TraceMessageBuilder()

      // Act
      const message = builder.build(eventWithUnit(workUnit('resolve.block', { completeFields: { visible: true } })))

      // Assert
      expect(message.trace.phases[0].units[0]).not.toHaveProperty('properties')
    })

    it('should forward the unit self duration when building a work unit', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const unit = workUnit('render.render-blocks', { durationMs: 6, selfDurationMs: 1.5 })

      // Act
      const message = builder.build(eventWithUnit(unit))

      // Assert
      expect(message.trace.phases[0].units[0].selfDurationMs).toBe(1.5)
    })

    it('should forward the unit execution slices when building a work unit', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const unit = workUnit('render.render-blocks', {
        executionSlices: [
          { startedAtMs: 0, completedAtMs: 2 },
          { startedAtMs: 5, completedAtMs: 6 },
        ],
      })

      // Act
      const message = builder.build(eventWithUnit(unit))

      // Assert
      expect(message.trace.phases[0].units[0].executionSlices).toEqual([
        { startedAtMs: 0, completedAtMs: 2 },
        { startedAtMs: 5, completedAtMs: 6 },
      ])
    })

    it('should forward phase and request durations from the trace values when building phases', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const renderPhase: RequestTracePhase = {
        phase: 'render',
        startedAtMs: 0,
        completedAtMs: 12,
        durationMs: 12,
        units: [
          workUnit('render.render-blocks', { startedAtMs: 0, completedAtMs: 5, durationMs: 5 }),
          workUnit('render.assemble-page', { startedAtMs: 5, completedAtMs: 12, durationMs: 7 }),
        ],
      }
      const accessPhase: RequestTracePhase = {
        phase: 'access',
        startedAtMs: 12,
        completedAtMs: 20,
        durationMs: 8,
        units: [workUnit('access.hook', { startedAtMs: 12, completedAtMs: 20, durationMs: 8 })],
      }

      // Act
      const message = builder.build(eventWithPhases([renderPhase, accessPhase], { durationMs: 20 }))

      // Assert
      expect(message.trace.phases[0].durationMs).toBe(12)
      expect(message.trace.phases[1].durationMs).toBe(8)
      expect(message.trace.durationMs).toBe(20)
    })

    it('should forward phase and unit timestamps unchanged when building a phase', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const renderPhase: RequestTracePhase = {
        phase: 'render',
        startedAtMs: 3,
        completedAtMs: 15,
        durationMs: 12,
        units: [workUnit('render.render-blocks', { startedAtMs: 3, completedAtMs: 15, durationMs: 12 })],
      }

      // Act
      const message = builder.build(eventWithPhases([renderPhase]))

      // Assert
      expect(message.trace.phases[0].startedAtMs).toBe(3)
      expect(message.trace.phases[0].completedAtMs).toBe(15)
      const built = message.trace.phases[0].units[0]
      expect(built.startedAtMs).toBe(3)
      expect(built.completedAtMs).toBe(15)
    })

    it('should default a phase duration to zero when the trace phase has no duration', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const renderPhase: RequestTracePhase = {
        phase: 'render',
        startedAtMs: 0,
        durationMs: undefined,
        units: [workUnit('render.render-blocks', { startedAtMs: 0, completedAtMs: 5 })],
      }

      // Act
      const message = builder.build(eventWithPhases([renderPhase]))

      // Assert
      expect(message.trace.phases[0].durationMs).toBe(0)
    })

    it('should pass the resolved route context through when the event carries one', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const event: RequestTraceEvent = {
        ...eventWithUnit(workUnit('render.render-blocks')),
        route: {
          journeyCode: 'apply',
          journeyTitle: 'Apply for something',
          stepTitle: 'Your details',
          routeTemplatePath: '/apply/details',
        },
      }

      // Act
      const message = builder.build(event)

      // Assert
      expect(message.route).toEqual({
        journeyCode: 'apply',
        journeyTitle: 'Apply for something',
        stepTitle: 'Your details',
        routeTemplatePath: '/apply/details',
      })
    })

    it('should fall back to the snapshot node id and pathname when the event carries no route', () => {
      // Arrange
      const builder = new TraceMessageBuilder()

      // Act
      const message = builder.build(eventWithUnit(workUnit('render.render-blocks')))

      // Assert
      expect(message.route).toEqual({
        journeyCode: 'journey::step',
        journeyTitle: 'journey::step',
        stepTitle: undefined,
        routeTemplatePath: '/step',
      })
    })

    it('should forward the request start time from the trace when building the message', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const renderPhase: RequestTracePhase = {
        phase: 'render',
        startedAtMs: 7,
        durationMs: 5,
        units: [workUnit('render.render-blocks', { startedAtMs: 7, completedAtMs: 12, durationMs: 5 })],
      }

      // Act
      const message = builder.build(eventWithPhases([renderPhase], { startedAtMs: 7 }))

      // Assert
      expect(message.trace.startedAtMs).toBe(7)
    })

    it('should forward the request inputs from the snapshot', () => {
      // Arrange
      const builder = new TraceMessageBuilder()

      // Act
      const message = builder.build(eventWithUnit(workUnit('render.render-blocks')))

      // Assert
      expect(message.request).toEqual({
        params: { journeyId: 'apply', stepId: 'details' },
        query: { edit: 'true', tags: ['a', 'b'] },
        post: { firstName: 'Ada', agree: true },
        state: { user: { id: 'u-1' }, csrfToken: 'tok' },
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: ['text/html', 'application/xhtml+xml'],
        },
        cookies: { sessionId: 'abc123' },
        session: { userId: 'u-1' },
      })
    })

    it('should forward the redirect target when the trace carries a redirect', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const event = eventWithPhases([{ phase: 'resolve', startedAtMs: 0, units: [] }], {
        outcome: 'redirect',
        redirect: { target: '/journey/next' },
      })

      // Act
      const message = builder.build(event)

      // Assert
      expect(message.trace.redirect).toEqual({ target: '/journey/next' })
    })

    it('should forward the error detail when the trace carries an error', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const event = eventWithPhases([{ phase: 'resolve', startedAtMs: 0, units: [] }], {
        outcome: 'error',
        error: { status: 403, message: 'Forbidden', stack: 'Error: Forbidden\n    at handler' },
      })

      // Act
      const message = builder.build(event)

      // Assert
      expect(message.trace.error).toEqual({
        status: 403,
        message: 'Forbidden',
        stack: 'Error: Forbidden\n    at handler',
      })
    })

    it('should omit redirect and error when the trace carries neither', () => {
      // Arrange
      const builder = new TraceMessageBuilder()

      // Act
      const message = builder.build(eventWithUnit(workUnit('render.render-blocks')))

      // Assert
      expect(message.trace).not.toHaveProperty('redirect')
      expect(message.trace).not.toHaveProperty('error')
    })

    it('should forward the reachability evaluation when the trace carries one', () => {
      // Arrange
      const builder = new TraceMessageBuilder()
      const event = eventWithPhases([{ phase: 'resolve', startedAtMs: 0, units: [] }], {
        reachability: traceReachability(),
      })

      // Act
      const message = builder.build(event)

      // Assert
      expect(message.trace.reachability).toEqual(traceReachability())
    })

    it('should omit reachability when the trace carries none', () => {
      // Arrange
      const builder = new TraceMessageBuilder()

      // Act
      const message = builder.build(eventWithUnit(workUnit('render.render-blocks')))

      // Assert
      expect(message.trace).not.toHaveProperty('reachability')
    })
  })
})
