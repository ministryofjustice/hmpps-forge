import type { NavigationRuntimePlan } from '../plans/runtimePlans.type'
import type { NodeId } from '../ast/ast.type'
import type { JourneyReachabilityState } from './journeyReachabilityState.type'
import type { NavigationEvaluation } from './navigationEvaluation.type'
import type { StepFieldInventory } from '../plans/stepFieldInventory.type'
import type { JourneyRouteTemplateCatalog } from '../routing/routeTree.type'

export interface NavigationEvaluationInput {
  plan: NavigationRuntimePlan
  currentStepId?: NodeId
  routeTemplateCatalog: JourneyRouteTemplateCatalog
  params?: Record<string, string>
  fieldInventory?: StepFieldInventory[]
}

export interface NavigationEvaluationResult {
  evaluation: NavigationEvaluation
  reachability?: JourneyReachabilityState
}
