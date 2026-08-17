import type { NodeId } from '../ast/ast.type'
import type { UnreachableRedirectTarget } from '../../../authoring/types/structures.type'

export interface StepRuntimePlan {
  stepId: NodeId
  path: string
}

/**
 * The per-journey static data the compiled reachability state function reads: the
 * ordered step table plus the journey-level navigation flags. Pure data — the
 * compiled functions live on `CompiledStep` / `CompiledJourney`, and the state
 * closure captures this table privately.
 */
export interface ReachabilityStateTable {
  entries: ReachabilityStateTableEntry[]
  unreachableRedirect: UnreachableRedirectTarget
  reachabilityDisabled: boolean
}

export interface ReachabilityStateTableEntry {
  stepId: NodeId
  code?: string
  isEntryPoint: boolean
}

export interface JourneyRuntimePlan {
  journeyId: NodeId
  path: string
}
