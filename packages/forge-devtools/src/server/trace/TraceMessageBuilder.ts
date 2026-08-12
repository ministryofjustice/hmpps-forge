import type { RequestTraceEvent, RequestTraceUnit } from '@ministryofjustice/hmpps-forge/core'

type RuntimeContextSnapshotTrace = Extract<RequestTraceUnit, { readonly kind: 'context-snapshot' }>

interface TraceSnapshotMessage {
  readonly answers: Record<string, unknown>
  readonly data: Record<string, unknown>
  readonly reachabilityValidities?: Record<string, unknown>
  readonly reachability?: unknown
}

interface TraceUnitMessage {
  readonly kind: string
  readonly durationMs?: number
  readonly selfDurationMs?: number
  readonly startedAtMs?: number
  readonly completedAtMs?: number
  readonly executionSlices?: readonly { readonly startedAtMs: number; readonly completedAtMs: number }[]
  readonly nodeId?: string
  readonly variant?: string
  readonly name?: string
  readonly properties?: Record<string, unknown>
  readonly fields?: Record<string, unknown>
  readonly snapshot?: TraceSnapshotMessage
  readonly children?: readonly TraceUnitMessage[]
}

interface PhaseMessage {
  readonly phase: string
  readonly outcome: string
  readonly durationMs: number
  readonly startedAtMs: number
  readonly completedAtMs?: number
  readonly units: readonly TraceUnitMessage[]
}

interface RouteContextMessage {
  readonly journeyCode: string
  readonly journeyTitle: string
  readonly stepTitle?: string
  readonly routeTemplatePath: string
}

interface TraceReachabilityStepMessage {
  readonly stepId: string
  readonly routeTemplatePath: string
  readonly code?: string
  readonly declarationIndex: number
  readonly isEntryPoint: boolean
  readonly isConditionalEntry: boolean
  readonly hasValidation: boolean
  readonly isReachable: boolean
  readonly isValid: boolean
  readonly forwardRouteTemplatePaths: readonly string[]
  readonly declaredForwardRouteTemplatePaths?: readonly string[]
  readonly predecessorRouteTemplatePaths: readonly string[]
  readonly tieBreakerPriority?: number
}

interface TraceReachabilityMessage {
  readonly currentStepId?: string
  readonly steps: readonly TraceReachabilityStepMessage[]
  readonly defaultEntryRouteTemplatePath?: string
  readonly frontierRouteTemplatePath?: string
  readonly canonicalPathRouteTemplatePaths: readonly string[]
  readonly progressExists: boolean
  readonly resumeActive: boolean
  readonly resumeOutcome: 'no-op' | 'redirect'
  readonly unreachableRedirect: 'entry' | 'frontier'
}

interface TraceRequestMessage {
  readonly params: Record<string, string>
  readonly query: Record<string, string | string[]>
  readonly post: Record<string, unknown>
  readonly state: Record<string, unknown>
  readonly headers: Record<string, string | string[] | undefined>
  readonly cookies: Record<string, string | undefined>
  readonly session: Record<string, unknown>
}

export interface TraceMessage extends Record<string, unknown> {
  readonly type: 'trace'
  readonly method: string
  readonly nodeId: string
  readonly pathname: string
  readonly trace: {
    readonly outcome: string
    readonly durationMs: number
    readonly startedAtMs: number
    readonly redirect?: { readonly target: string }
    readonly error?: { readonly status?: number; readonly message: string; readonly stack?: string }
    readonly reachability?: TraceReachabilityMessage
    readonly phases: readonly PhaseMessage[]
  }
  readonly route: RouteContextMessage
  readonly request: TraceRequestMessage
}

export default class TraceMessageBuilder {
  build(event: RequestTraceEvent): TraceMessage {
    const phases = event.trace.phases.map(phase => ({
      phase: phase.phase,
      outcome: event.trace.outcome,
      durationMs: phase.durationMs ?? 0,
      startedAtMs: phase.startedAtMs,
      completedAtMs: phase.completedAtMs,
      units: phase.units.map(unit => this.buildUnit(unit)),
    }))

    return {
      type: 'trace',
      method: event.snapshot.method,
      nodeId: event.snapshot.nodeId,
      pathname: event.snapshot.location.pathname,
      trace: {
        outcome: event.trace.outcome,
        durationMs: event.trace.durationMs ?? 0,
        startedAtMs: event.trace.startedAtMs,
        ...(event.trace.redirect ? { redirect: event.trace.redirect } : {}),
        ...(event.trace.error ? { error: event.trace.error } : {}),
        ...(event.trace.reachability ? { reachability: event.trace.reachability } : {}),
        phases,
      },
      route: this.buildRouteContext(event),
      request: {
        params: event.snapshot.params,
        query: event.snapshot.query,
        post: event.snapshot.post,
        state: event.snapshot.state,
        headers: event.snapshot.headers,
        cookies: event.snapshot.cookies,
        // The core snapshot types the session as `unknown` (adapters vary); the panel treats it as a
        // record for display, so widen it at this wire boundary.
        session: event.snapshot.session as Record<string, unknown>,
      },
    }
  }

  private buildUnit(unit: RequestTraceUnit): TraceUnitMessage {
    if (this.isContextSnapshotTrace(unit)) {
      return {
        kind: unit.kind,
        name: unit.key,
        snapshot: {
          answers: unit.answers,
          data: unit.data,
          reachabilityValidities: unit.reachabilityValidities,
          reachability: unit.reachability,
        },
        children: [],
      }
    }

    const { properties, ...fields } = { ...unit.beginFields, ...unit.completeFields }

    return {
      kind: unit.kind,
      durationMs: unit.durationMs,
      selfDurationMs: unit.selfDurationMs,
      startedAtMs: unit.startedAtMs,
      completedAtMs: unit.completedAtMs,
      executionSlices: unit.executionSlices,
      nodeId: this.resolveStringField(fields, ['nodeId', 'id', 'stepId', 'currentStepId']),
      variant: this.resolveStringField(fields, ['variant', 'mode', 'stage', 'blockType', 'outcome']),
      name: this.resolveStringField(fields, ['name', 'code']),
      ...(this.isRecord(properties) ? { properties } : {}),
      ...(Object.keys(fields).length > 0 ? { fields } : {}),
      children: unit.children.map(child => this.buildUnit(child)),
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value)
  }

  private resolveStringField(fields: Record<string, unknown>, names: readonly string[]): string | undefined {
    const value = names.map(name => fields[name]).find(field => typeof field === 'string')

    return typeof value === 'string' ? value : undefined
  }

  private buildRouteContext(event: RequestTraceEvent): RouteContextMessage {
    const { route } = event

    return {
      journeyCode: route?.journeyCode ?? event.snapshot.nodeId,
      journeyTitle: route?.journeyTitle ?? event.snapshot.nodeId,
      stepTitle: route?.stepTitle,
      routeTemplatePath: route?.routeTemplatePath ?? event.snapshot.location.pathname,
    }
  }

  private isContextSnapshotTrace(unit: RequestTraceUnit): unit is RuntimeContextSnapshotTrace {
    return unit.kind === 'context-snapshot'
  }
}
