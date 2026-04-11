import { NavigationEvaluation, NavigationStepState } from '../types/NavigationEvaluation.type'

export default class BacklinkResolver {
  resolve(evaluation: NavigationEvaluation): string | undefined {
    const currentStep = evaluation.steps.find(step => step.stepId === evaluation.currentStepId)

    return this.resolveForStep(currentStep)
  }

  resolveForStep(step: NavigationStepState | undefined): string | undefined {
    if (!step) {
      return undefined
    }

    if (step.predecessorRouteTemplatePaths.length !== 1) {
      return undefined
    }

    return step.predecessorRouteTemplatePaths[0]
  }
}
