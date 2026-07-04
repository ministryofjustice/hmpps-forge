import type { RequestSnapshot } from '../../../framework/types/snapshot.type'
import type { JourneyReachabilityProjection } from '../reachability/journeyReachabilityProjection.type'
import type { AnswerHistory } from './answerHistory.type'
import type { NodeId } from '../ast/ast.type'
import type { StepValidityResult } from './stepValidityResult.type'
import type { WorkUnitFields } from './work.type'

export interface WorkUnitTrace {
  readonly key: string
  readonly kind: string
  readonly beginFields: WorkUnitFields
  readonly completeFields: WorkUnitFields
  readonly completed: boolean
  readonly startedAtMs: number
  readonly completedAtMs?: number
  readonly durationMs?: number
  readonly children: readonly WorkUnitTrace[]
}

export interface RuntimeContextSnapshotTrace {
  readonly key: string
  readonly kind: 'context-snapshot'
  readonly beginFields: WorkUnitFields
  readonly completeFields: WorkUnitFields
  readonly completed: true
  readonly children: readonly []
  readonly answers: Record<string, AnswerHistory>
  readonly data: Record<string, unknown>
  readonly stepValidities?: Record<NodeId, StepValidityResult>
  readonly reachability?: JourneyReachabilityProjection
}

export type RequestTraceUnit = WorkUnitTrace | RuntimeContextSnapshotTrace

export interface RequestTracePhase {
  readonly phase: string
  readonly startedAtMs: number
  readonly completedAtMs?: number
  readonly durationMs?: number
  readonly units: readonly RequestTraceUnit[]
}

export interface RequestTrace {
  readonly outcome: 'render' | 'redirect' | 'error'
  readonly startedAtMs: number
  readonly completedAtMs?: number
  readonly durationMs?: number
  readonly phases: readonly RequestTracePhase[]
}

export interface RequestTraceEvent {
  readonly snapshot: RequestSnapshot
  readonly trace: RequestTrace
}
