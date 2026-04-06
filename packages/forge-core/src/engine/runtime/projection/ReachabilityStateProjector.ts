import ThunkEvaluationContext, {
  JourneyReachabilityState,
  ReachabilityStep,
} from '../../compilation/thunks/ThunkEvaluationContext'
import BacklinkResolver from '../resolution/BacklinkResolver'
import { NavigationStepState } from '../types/NavigationEvaluation.type'
import RuntimeArtifacts from '../RuntimeArtifacts'
import { StepFieldInventory } from '../types/StepFieldInventory.type'

export default class ReachabilityStateProjector {
  private readonly backlinkResolver = new BacklinkResolver()

  projectToContext(artifacts: RuntimeArtifacts, context: ThunkEvaluationContext): void {
    context.global.reachability = this.project(artifacts)
  }

  project(artifacts: RuntimeArtifacts): JourneyReachabilityState {
    const evaluation = artifacts.requireNavigation()
    const fieldInventory = artifacts.requireStepFieldInventory()

    const inventoryByStepId = new Map(fieldInventory.map(inv => [inv.stepId, inv]))
    const reachableSteps: ReachabilityStep[] = []
    const unreachableSteps: ReachabilityStep[] = []

    evaluation.steps.forEach(step => {
      const inventory = inventoryByStepId.get(step.stepId)
      const projectedStep = this.projectStep(step, inventory)

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

  private projectStep(step: NavigationStepState, inventory: StepFieldInventory | undefined): ReachabilityStep {
    const projectedStep: ReachabilityStep = { path: step.path }

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
      projectedStep.backPath = backPath
    }

    return projectedStep
  }
}
