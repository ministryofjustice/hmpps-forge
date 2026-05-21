import { NavigationEvaluation } from '../../types/NavigationEvaluation.type'

export function resolveBacklinkRouteTemplatePath(evaluation: NavigationEvaluation): string | undefined {
  const currentStep = evaluation.steps.find(step => step.stepId === evaluation.currentStepId)

  if (!currentStep) {
    return undefined
  }

  const currentIndex = evaluation.canonicalPathRouteTemplatePaths.indexOf(currentStep.routeTemplatePath)

  if (currentIndex <= 0) {
    return undefined
  }

  return evaluation.canonicalPathRouteTemplatePaths[currentIndex - 1]
}

export function resolveStepRequestRedirect(evaluation: NavigationEvaluation): string | undefined {
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

  return resolveUnreachableRedirect(evaluation)
}

export function resolvePostRequestRedirect(evaluation: NavigationEvaluation): string | undefined {
  const currentStep = evaluation.steps.find(step => step.stepId === evaluation.currentStepId)

  if (!currentStep) {
    return undefined
  }

  if (currentStep.isReachable) {
    return undefined
  }

  return resolveUnreachableRedirect(evaluation)
}

function resolveUnreachableRedirect(evaluation: NavigationEvaluation): string | undefined {
  if (evaluation.unreachableRedirect === 'frontier') {
    return evaluation.frontierRouteTemplatePath ?? evaluation.defaultEntryRouteTemplatePath
  }

  return evaluation.defaultEntryRouteTemplatePath
}

export function resolveJourneyRootRedirect(evaluation: NavigationEvaluation): string | undefined {
  if (evaluation.resumeOutcome === 'redirect') {
    return evaluation.frontierRouteTemplatePath
  }

  return evaluation.defaultEntryRouteTemplatePath
}
