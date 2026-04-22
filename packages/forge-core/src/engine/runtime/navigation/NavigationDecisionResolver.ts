import { NavigationEvaluation } from './NavigationEvaluation.type'

export default class NavigationDecisionResolver {
  resolveStepRequestRedirect(evaluation: NavigationEvaluation): string | undefined {
    const currentStep = evaluation.steps.find(step => step.stepId === evaluation.currentStepId)

    if (!currentStep) {
      return undefined
    }

    if (evaluation.resumeOutcome === 'redirect') {
      return evaluation.frontierRouteTemplatePath
    }

    if (currentStep.isReachable) {
      return undefined
    }

    return evaluation.defaultEntryRouteTemplatePath
  }

  resolvePostRequestRedirect(evaluation: NavigationEvaluation): string | undefined {
    const currentStep = evaluation.steps.find(step => step.stepId === evaluation.currentStepId)

    if (!currentStep) {
      return undefined
    }

    if (currentStep.isReachable) {
      return undefined
    }

    return evaluation.defaultEntryRouteTemplatePath
  }

  resolveJourneyRootRedirect(evaluation: NavigationEvaluation): string | undefined {
    if (evaluation.resumeOutcome === 'redirect') {
      return evaluation.frontierRouteTemplatePath
    }

    return evaluation.defaultEntryRouteTemplatePath
  }
}
