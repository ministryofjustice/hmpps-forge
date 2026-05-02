import type { NavigationRuntimePlan } from './runtimePlans.type'
import type { NodeId } from './ast.type'
import type { JourneyReachabilityState } from './JourneyReachabilityState.type'
import type { NavigationEvaluation } from './NavigationEvaluation.type'
import type { StepFieldInventory } from './StepFieldInventory.type'
import type { JourneyRouteTemplateCatalog } from '../runtime/types/routes.type'

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
