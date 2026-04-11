import { NavigationEvaluation } from '../types/NavigationEvaluation.type'

export default class RedirectResolver {
  resolve(evaluation: NavigationEvaluation): string | undefined {
    const currentStep = evaluation.steps.find(step => step.stepId === evaluation.currentStepId)

    if (!currentStep || currentStep.isReachable) {
      return undefined
    }

    const blockerPaths = evaluation.steps
      .filter(step => step.isReachable && !step.isValid)
      .map(step => step.routeTemplatePath)

    if (blockerPaths.length === 1) {
      return blockerPaths[0]
    }

    const reachableEntryPoint = evaluation.steps.find(step => step.isEntryPoint && step.isReachable)

    return reachableEntryPoint?.routeTemplatePath ?? evaluation.steps[0]?.routeTemplatePath
  }
}
