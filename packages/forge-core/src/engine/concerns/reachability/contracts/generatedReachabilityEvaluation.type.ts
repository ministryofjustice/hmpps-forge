import type { NodeId } from '../../../chassis/contracts/ast/ast.type'
import type { JourneyReachabilityProjection } from './journeyReachabilityProjection.type'
import type { ReachabilityEvaluation } from './reachabilityEvaluation.type'
import type { CompiledReachabilityResult } from '../../../chassis/contracts/compiled/compiledFunctions.type'
import type { StepFieldInventory } from '../../answer-cleardown/contracts/stepFieldInventory.type'
import type { JourneyRouteTemplateCatalog } from '../../route/contracts/routeTree.type'

/** Request-time input to the compiled reachability state function. */
export interface ReachabilityStateInput {
  facts: CompiledReachabilityResult
  currentStepId?: NodeId
  routeTemplateCatalog: JourneyRouteTemplateCatalog
  // Present iff the step has validation; the value is its reachability-mode validity.
  stepValidities: ReadonlyMap<NodeId, boolean>
  params?: Record<string, string>
  // Present on step requests only; the projection needs it alongside params.
  fieldInventory?: StepFieldInventory[]
}

export interface ReachabilityEvaluationResult {
  evaluation: ReachabilityEvaluation
  reachability?: JourneyReachabilityProjection
}
