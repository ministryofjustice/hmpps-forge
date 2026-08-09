import type { NodeId } from '../../../contracts/ast/ast.type'
import type { JourneyReachabilityProjection } from './journeyReachabilityProjection.type'
import type { ReachabilityEvaluation } from './reachabilityEvaluation.type'
import type { CompiledReachabilityResult } from '../../../contracts/compiled/compiledFunctions.type'
import type { JourneyRouteTemplateCatalog } from '../../route/contracts/routeTree.type'

/** Request-time input the compiled facts function needs to decide field inventory. */
export interface ReachabilityFactsInput {
  params?: Record<string, string>
}

/** Request-time input to the compiled reachability state function. */
export interface ReachabilityStateInput {
  facts: CompiledReachabilityResult
  currentStepId?: NodeId
  routeTemplateCatalog: JourneyRouteTemplateCatalog
  // Present iff the step has validation; the value is its reachability-mode validity.
  stepValidities: ReadonlyMap<NodeId, boolean>
  params?: Record<string, string>
}

export interface ReachabilityEvaluationResult {
  evaluation: ReachabilityEvaluation
  reachability?: JourneyReachabilityProjection
}
