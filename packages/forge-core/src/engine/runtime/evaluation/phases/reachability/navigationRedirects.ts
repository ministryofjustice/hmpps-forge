import type { ReachabilityEvaluation } from '../../../../contracts/navigation/reachabilityEvaluation.type'
import type { HttpMethod } from '../../../../../framework/types/request.type'

export function resolveBacklinkRouteTemplatePath(evaluation: ReachabilityEvaluation): string | undefined {
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

export function resolveRedirect(
  evaluation: ReachabilityEvaluation,
  nodeKind: 'step' | 'journey',
  method: HttpMethod,
): string | undefined {
  if (nodeKind === 'journey') {
    if (evaluation.resumeOutcome === 'redirect') {
      return evaluation.frontierRouteTemplatePath
    }

    return evaluation.defaultEntryRouteTemplatePath
  }

  const currentStep = evaluation.steps.find(step => step.stepId === evaluation.currentStepId)

  if (!currentStep) {
    return undefined
  }

  if (method === 'GET' && evaluation.resumeOutcome === 'redirect') {
    return evaluation.frontierRouteTemplatePath
  }

  if (currentStep.isReachable) {
    return undefined
  }

  return resolveUnreachableRedirect(evaluation)
}

function resolveUnreachableRedirect(evaluation: ReachabilityEvaluation): string | undefined {
  if (evaluation.unreachableRedirect === 'frontier') {
    return evaluation.frontierRouteTemplatePath ?? evaluation.defaultEntryRouteTemplatePath
  }

  return evaluation.defaultEntryRouteTemplatePath
}
