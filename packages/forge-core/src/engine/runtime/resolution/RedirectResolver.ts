import { NavigationEvaluation } from '../types/NavigationEvaluation.type'

export default class RedirectResolver {
  resolve(evaluation: NavigationEvaluation): string | undefined {
    const currentStep = evaluation.steps.find(step => step.stepId === evaluation.currentStepId)

    if (!currentStep) {
      return undefined
    }

    if (evaluation.resumeActive) {
      const frontier = evaluation.redirectTargetRouteTemplatePath

      if (frontier && frontier !== currentStep.routeTemplatePath) {
        return frontier
      }

      return undefined
    }

    if (currentStep.isReachable) {
      return undefined
    }

    return evaluation.redirectTargetRouteTemplatePath
  }
}
