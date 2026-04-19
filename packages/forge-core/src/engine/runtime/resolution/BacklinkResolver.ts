import { NavigationEvaluation, NavigationStepState } from '../types/NavigationEvaluation.type'
import { pickTieBreakerWinner } from './tieBreakerSelection'

export default class BacklinkResolver {
  resolve(evaluation: NavigationEvaluation): string | undefined {
    const currentStep = evaluation.steps.find(step => step.stepId === evaluation.currentStepId)

    return this.resolveForStep(currentStep, evaluation.steps)
  }

  resolveForStep(step: NavigationStepState | undefined, allSteps: NavigationStepState[]): string | undefined {
    if (!step) {
      return undefined
    }

    const predecessorPaths = step.predecessorRouteTemplatePaths

    if (predecessorPaths.length === 0) {
      return undefined
    }

    if (predecessorPaths.length === 1) {
      return predecessorPaths[0]
    }

    const predecessorCandidates = allSteps.filter(candidate => predecessorPaths.includes(candidate.routeTemplatePath))

    return pickTieBreakerWinner(predecessorCandidates)?.routeTemplatePath
  }
}
