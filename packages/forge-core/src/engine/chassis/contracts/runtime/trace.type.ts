import type { RequestSnapshot } from '../../../../framework/types/snapshot.type'
import type { JourneyReachabilityProjection } from '../../../concerns/reachability/contracts/journeyReachabilityProjection.type'
import type { ResumeOutcome } from '../../../concerns/reachability/contracts/reachabilityEvaluation.type'
import type { UnreachableRedirectTarget } from '../../../../authoring/types/structures.type'
import type { AnswerHistory } from './answerHistory.type'
import type { NodeId } from '../ast/ast.type'
import type { StepValidityResult } from '../../../concerns/validation/contracts/stepValidityResult.type'
import type { SerializedTraceSpan, TraceSpanFields } from '../../tracing/traceSpan.type'

export interface RuntimeContextSnapshotTrace {
  readonly key: string
  readonly kind: 'context-snapshot'
  readonly beginFields: TraceSpanFields
  readonly completeFields: TraceSpanFields
  readonly completed: true
  readonly children: readonly []
  readonly answers: Record<string, AnswerHistory>
  readonly data: Record<string, unknown>
  readonly reachabilityValidities?: Record<NodeId, StepValidityResult>
  readonly reachability?: JourneyReachabilityProjection
}

export type RequestTraceUnit = SerializedTraceSpan | RuntimeContextSnapshotTrace

export interface RequestTracePhase {
  readonly phase: string
  readonly startedAtMs: number
  readonly completedAtMs?: number
  readonly durationMs?: number
  readonly units: readonly RequestTraceUnit[]
}

export interface RequestTraceRedirect {
  readonly target: string
}

export interface RequestTraceError {
  readonly status?: number
  readonly message: string
  readonly stack?: string
}

/** One step in the request's reachability graph, projected from the runtime `ReachabilityNode`. */
export interface RequestTraceReachabilityStep {
  readonly stepId: NodeId
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

/** The request's reachability graph, projected from the runtime `ReachabilityEvaluation`. */
export interface RequestTraceReachability {
  readonly currentStepId?: NodeId
  readonly steps: readonly RequestTraceReachabilityStep[]
  readonly defaultEntryRouteTemplatePath?: string
  readonly frontierRouteTemplatePath?: string
  readonly canonicalPathRouteTemplatePaths: readonly string[]
  readonly progressExists: boolean
  readonly resumeActive: boolean
  readonly resumeOutcome: ResumeOutcome
  readonly unreachableRedirect: UnreachableRedirectTarget
}

export interface RequestTrace {
  readonly outcome: 'render' | 'redirect' | 'error'
  readonly startedAtMs: number
  readonly completedAtMs?: number
  readonly durationMs?: number
  readonly redirect?: RequestTraceRedirect
  readonly error?: RequestTraceError
  readonly reachability?: RequestTraceReachability
  readonly phases: readonly RequestTracePhase[]
}

export interface RequestTraceRouteContext {
  readonly journeyCode: string
  readonly journeyTitle?: string
  readonly stepTitle?: string
  readonly routeTemplatePath: string
}

export interface RequestTraceEvent {
  readonly snapshot: RequestSnapshot
  readonly trace: RequestTrace
  readonly route?: RequestTraceRouteContext
}
