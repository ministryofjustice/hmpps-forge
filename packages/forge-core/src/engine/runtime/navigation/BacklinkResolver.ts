import { NavigationEvaluation, NavigationStepState } from './NavigationEvaluation.type'

export default class BacklinkResolver {
  resolve(evaluation: NavigationEvaluation): string | undefined {
    const currentStep = evaluation.steps.find(step => step.stepId === evaluation.currentStepId)

    return this.resolveForStep(currentStep, evaluation.canonicalPathRouteTemplatePaths)
  }

  resolveForStep(step: NavigationStepState | undefined, canonicalPathRouteTemplatePaths: string[]): string | undefined {
    if (!step) {
      return undefined
    }

    const currentIndex = canonicalPathRouteTemplatePaths.indexOf(step.routeTemplatePath)

    if (currentIndex <= 0) {
      return undefined
    }

    return canonicalPathRouteTemplatePaths[currentIndex - 1]
  }
}
