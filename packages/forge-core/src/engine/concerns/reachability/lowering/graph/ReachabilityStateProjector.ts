import { resolvePathParams } from '../../../../../shared/routePath'
import {
  JourneyReachabilityProjection,
  StepReachabilityProjection,
} from '../../contracts/journeyReachabilityProjection.type'
import { ReachabilityEvaluation, ReachabilityNode } from '../../contracts/reachabilityEvaluation.type'
import { resolveBacklinkRouteTemplatePathForStep } from './ReachabilityPathAnalyzer'
import { StepFieldInventory } from '../../../answer-cleardown/contracts/stepFieldInventory.type'

export default class ReachabilityStateProjector {
  project(
    evaluation: ReachabilityEvaluation,
    fieldInventory: StepFieldInventory[],
    params: Record<string, string>,
  ): JourneyReachabilityProjection {
    const inventoryByStepId = new Map(fieldInventory.map(inv => [inv.stepId, inv]))
    const reachableSteps: StepReachabilityProjection[] = []
    const unreachableSteps: StepReachabilityProjection[] = []

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
    step: ReachabilityNode,
    inventory: StepFieldInventory | undefined,
    params: Record<string, string>,
    canonicalPathRouteTemplatePaths: string[],
  ): StepReachabilityProjection {
    const projectedStep: StepReachabilityProjection = { path: resolvePathParams(step.routeTemplatePath, params) }

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
