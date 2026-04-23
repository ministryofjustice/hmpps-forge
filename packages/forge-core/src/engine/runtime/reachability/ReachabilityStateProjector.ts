import RuntimeEvaluationContext, {
  JourneyReachabilityState,
  ReachabilityStep,
} from '../context/RuntimeEvaluationContext'
import { resolvePathParams } from '../../../framework/path/routePath'
import { NavigationEvaluation, NavigationStepState } from '../types/NavigationEvaluation.type'
import { resolveBacklinkRouteTemplatePathForStep } from '../navigation/NavigationPathAnalyzer'
import { StepFieldInventory } from '../types/StepFieldInventory.type'

export default class ReachabilityStateProjector {
  projectToContext(
    evaluation: NavigationEvaluation,
    fieldInventory: StepFieldInventory[],
    context: RuntimeEvaluationContext,
  ): void {
    context.global.reachability = this.project(evaluation, fieldInventory, context.request.getParams())
  }

  project(
    evaluation: NavigationEvaluation,
    fieldInventory: StepFieldInventory[],
    params: Record<string, string>,
  ): JourneyReachabilityState {
    const inventoryByStepId = new Map(fieldInventory.map(inv => [inv.stepId, inv]))
    const reachableSteps: ReachabilityStep[] = []
    const unreachableSteps: ReachabilityStep[] = []

    evaluation.steps.forEach(step => {
      const inventory = inventoryByStepId.get(step.stepId)
      const projectedStep = this.projectStep(step, inventory, params, evaluation.canonicalPathRouteTemplatePaths)

      if (step.isReachable) {
        reachableSteps.push(projectedStep)
      } else {
        unreachableSteps.push(projectedStep)
      }
    })

    return {
      reachableSteps,
      unreachableSteps,
    }
  }

  private projectStep(
    step: NavigationStepState,
    inventory: StepFieldInventory | undefined,
    params: Record<string, string>,
    canonicalPathRouteTemplatePaths: string[],
  ): ReachabilityStep {
    const projectedStep: ReachabilityStep = { path: resolvePathParams(step.routeTemplatePath, params) }

    if (step.code) {
      projectedStep.code = step.code
    }

    const fieldCodes = inventory?.fieldCodes ?? []
    const cleardownFieldCodes = inventory?.cleardownFieldCodes ?? []

    if (fieldCodes.length > 0) {
      projectedStep.fieldCodes = fieldCodes
    }

    if (cleardownFieldCodes.length > 0) {
      projectedStep.cleardownFieldCodes = cleardownFieldCodes
    }

    const backPath = resolveBacklinkRouteTemplatePathForStep(step, canonicalPathRouteTemplatePaths)

    if (backPath) {
      projectedStep.backPath = resolvePathParams(backPath, params)
    }

    return projectedStep
  }
}
