import type { NavigationRuntimePlan } from '../plans/runtimePlans.type'
import type { NodeId } from '../ast/ast.type'
import type { JourneyReachabilityState } from './journeyReachabilityState.type'
import type { ReachabilityEvaluation } from './reachabilityEvaluation.type'
import type { StepFieldInventory } from '../plans/stepFieldInventory.type'
import type { StepValidityResult } from '../runtime/stepValidityResult.type'
import type { JourneyRouteTemplateCatalog } from '../routing/routeTree.type'

export interface ReachabilityEvaluationInput {
  plan: NavigationRuntimePlan
  currentStepId?: NodeId
  routeTemplateCatalog: JourneyRouteTemplateCatalog
  params?: Record<string, string>
  fieldInventory?: StepFieldInventory[]
  stepValidities?: ReadonlyMap<NodeId, StepValidityResult>
}

export interface ReachabilityEvaluationResult {
  evaluation: ReachabilityEvaluation
  reachability?: JourneyReachabilityState
}
