import ThunkEvaluationContext, {
  JourneyReachabilityState,
  ReachabilityStep,
} from '../../compilation/thunks/ThunkEvaluationContext'
import { resolvePathParams } from '../../../framework/path/routePath'
import BacklinkResolver from '../resolution/BacklinkResolver'
import { NavigationStepState } from '../types/NavigationEvaluation.type'
import RuntimeArtifacts from '../RuntimeArtifacts'
import { StepFieldInventory } from '../types/StepFieldInventory.type'

export default class ReachabilityStateProjector {
  private readonly backlinkResolver = new BacklinkResolver()

  projectToContext(artifacts: RuntimeArtifacts, context: ThunkEvaluationContext): void {
    context.global.reachability = this.project(artifacts, context.request.getParams())
  }

  project(artifacts: RuntimeArtifacts, params: Record<string, string>): JourneyReachabilityState {
    const evaluation = artifacts.requireNavigation()
    const fieldInventory = artifacts.requireStepFieldInventory()

    const inventoryByStepId = new Map(fieldInventory.map(inv => [inv.stepId, inv]))
    const reachableSteps: ReachabilityStep[] = []
    const unreachableSteps: ReachabilityStep[] = []

    evaluation.steps.forEach(step => {
      const inventory = inventoryByStepId.get(step.stepId)
      const projectedStep = this.projectStep(step, inventory, params)

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

    const backPath = this.backlinkResolver.resolveForStep(step)

    if (backPath) {
      projectedStep.backPath = resolvePathParams(backPath, params)
    }

    return projectedStep
  }
}
