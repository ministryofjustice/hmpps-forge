import { pickTieBreakerWinner } from './tieBreakerSelection'
import { NodeId } from '../../types/ast.type'
import { NavigationStepState } from '../types/NavigationEvaluation.type'

export interface LinearPathResolution {
  canonicalPathRouteTemplatePaths: string[]
  frontierRouteTemplatePath: string | undefined
  progressExists: boolean
}

interface ProgressPathCandidate {
  entry: NavigationStepState
  path: NavigationStepState[]
  progressDepth: number
}

export default class LinearPathResolver {
  resolve(
    steps: NavigationStepState[],
    currentStepId: NodeId | undefined,
    defaultEntryRouteTemplatePath: string | undefined,
    resumeActive: boolean,
  ): LinearPathResolution {
    const progressExists = this.resolveProgressExists(steps)
    const defaultPath = this.resolvePathFromAnchorRouteTemplatePath(defaultEntryRouteTemplatePath, steps)
    const resumePath = this.resolveResumePath(steps)
    const canonicalPath = this.resolveCanonicalPath(steps, currentStepId, resumeActive, defaultPath, resumePath)

    return {
      canonicalPathRouteTemplatePaths: canonicalPath.map(step => step.routeTemplatePath),
      frontierRouteTemplatePath: this.resolveFrontierRouteTemplatePath(canonicalPath),
      progressExists,
    }
  }

  private resolveCanonicalPath(
    steps: NavigationStepState[],
    currentStepId: NodeId | undefined,
    resumeActive: boolean,
    defaultPath: NavigationStepState[],
    resumePath: NavigationStepState[] | undefined,
  ): NavigationStepState[] {
    if (resumeActive && resumePath) {
      return resumePath
    }

    if (currentStepId !== undefined) {
      const currentStepPath = this.resolvePathThroughCurrentStep(currentStepId, steps)

      if (currentStepPath.length > 0) {
        return currentStepPath
      }
    }

    return defaultPath
  }

  private resolveProgressExists(steps: NavigationStepState[]): boolean {
    return steps.some(step => step.isReachable && step.hasValidation && step.isValid)
  }

  private resolveResumePath(steps: NavigationStepState[]): NavigationStepState[] | undefined {
    const candidates = steps
      .filter(step => this.isActiveEntry(step))
      .map(entry => {
        const path = this.resolvePathFromAnchorStep(entry, steps)

        return {
          entry,
          path,
          progressDepth: this.resolveProgressDepth(path),
        } satisfies ProgressPathCandidate
      })
      .filter(candidate => candidate.progressDepth >= 0)

    if (candidates.length === 0) {
      return undefined
    }

    const winner = candidates.reduce((best, candidate) => {
      if (candidate.progressDepth !== best.progressDepth) {
        return candidate.progressDepth > best.progressDepth ? candidate : best
      }

      const tieBreakerWinner = pickTieBreakerWinner([best.entry, candidate.entry])

      if (tieBreakerWinner?.routeTemplatePath === candidate.entry.routeTemplatePath) {
        return candidate
      }

      return best
    })

    return winner.path
  }

  private resolveProgressDepth(path: NavigationStepState[]): number {
    let lastProgressIndex = -1

    path.forEach((step, index) => {
      if (step.isReachable && step.hasValidation && step.isValid) {
        lastProgressIndex = index
      }
    })

    return lastProgressIndex
  }

  private resolvePathThroughCurrentStep(currentStepId: NodeId, steps: NavigationStepState[]): NavigationStepState[] {
    const currentStep = steps.find(step => step.stepId === currentStepId)

    if (!currentStep?.isReachable) {
      return []
    }

    const pathToCurrent = this.resolvePathToCurrentStep(currentStep, steps)
    const pathFromCurrent = this.resolveForwardPath(currentStep, steps)

    return [...pathToCurrent, ...pathFromCurrent.slice(1)]
  }

  private resolvePathToCurrentStep(step: NavigationStepState, steps: NavigationStepState[]): NavigationStepState[] {
    const stepByRouteTemplatePath = new Map(steps.map(candidate => [candidate.routeTemplatePath, candidate]))
    const path = [step]
    const visited = new Set([step.routeTemplatePath])
    let current = step

    while (!this.isActiveEntry(current) && current.predecessorRouteTemplatePaths.length > 0) {
      const predecessors = current.predecessorRouteTemplatePaths
        .map(routeTemplatePath => stepByRouteTemplatePath.get(routeTemplatePath))
        .filter((candidate): candidate is NavigationStepState => candidate !== undefined)

      const previous = pickTieBreakerWinner(predecessors)

      if (!previous || visited.has(previous.routeTemplatePath)) {
        break
      }

      path.unshift(previous)
      visited.add(previous.routeTemplatePath)
      current = previous
    }

    return path
  }

  private resolvePathFromAnchorRouteTemplatePath(
    anchorRouteTemplatePath: string | undefined,
    steps: NavigationStepState[],
  ): NavigationStepState[] {
    if (!anchorRouteTemplatePath) {
      return []
    }

    const anchor = steps.find(step => step.routeTemplatePath === anchorRouteTemplatePath)

    if (!anchor) {
      return []
    }

    if (!anchor.isReachable) {
      return [anchor]
    }

    return this.resolvePathFromAnchorStep(anchor, steps)
  }

  private resolvePathFromAnchorStep(anchor: NavigationStepState, steps: NavigationStepState[]): NavigationStepState[] {
    if (!anchor.isReachable) {
      return [anchor]
    }

    return this.resolveForwardPath(anchor, steps)
  }

  private resolveForwardPath(start: NavigationStepState, steps: NavigationStepState[]): NavigationStepState[] {
    const stepByRouteTemplatePath = new Map(steps.map(step => [step.routeTemplatePath, step]))
    const path = [start]
    const visited = new Set([start.routeTemplatePath])
    let current = start

    while (current.isValid && current.forwardRouteTemplatePaths.length > 0) {
      const successors = current.forwardRouteTemplatePaths
        .map(routeTemplatePath => stepByRouteTemplatePath.get(routeTemplatePath))
        .filter((candidate): candidate is NavigationStepState => candidate !== undefined && candidate.isReachable)

      const next = pickTieBreakerWinner(successors)

      if (!next || visited.has(next.routeTemplatePath)) {
        break
      }

      path.push(next)
      visited.add(next.routeTemplatePath)
      current = next
    }

    return path
  }

  private resolveFrontierRouteTemplatePath(path: NavigationStepState[]): string | undefined {
    const nonEntrySteps = path.filter(step => !this.isActiveEntry(step))
    const firstInvalid = nonEntrySteps.find(step => !step.isValid)

    if (firstInvalid) {
      return firstInvalid.routeTemplatePath
    }

    const hasProgress = nonEntrySteps.some(step => step.hasValidation && step.isValid)
    const terminal = nonEntrySteps[nonEntrySteps.length - 1]

    if (hasProgress && terminal && !(terminal.hasValidation && terminal.isValid)) {
      return terminal.routeTemplatePath
    }

    return undefined
  }

  private isActiveEntry(step: NavigationStepState): boolean {
    return step.isEntryPoint || step.isConditionalEntry
  }
}
