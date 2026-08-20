import { NodeId } from '../../../../chassis/contracts/ast/ast.type'
import { ReachabilityNode } from '../../contracts/reachabilityEvaluation.type'

export interface ReachabilityPathAnalysis {
  canonicalPathRouteTemplatePaths: string[]
  frontierRouteTemplatePath: string | undefined
  progressExists: boolean
}

interface ProgressPathCandidate {
  entry: ReachabilityNode
  path: ReachabilityNode[]
  progressDepth: number
}

/**
 * Picks the winning candidate according to reachability tie-breakers.
 *
 * Candidates must be supplied in journey declaration order. The highest
 * compiled priority wins; unmatched candidates fall back to declaration order.
 */
export function pickTieBreakerWinner(candidates: ReachabilityNode[]): ReachabilityNode | undefined {
  if (candidates.length === 0) {
    return undefined
  }

  return candidates.reduce((best, candidate) => {
    const bestPriority = best.tieBreakerPriority ?? -Infinity
    const candidatePriority = candidate.tieBreakerPriority ?? -Infinity

    return candidatePriority > bestPriority ? candidate : best
  })
}

export function resolveBacklinkRouteTemplatePathForStep(
  step: ReachabilityNode | undefined,
  canonicalPathRouteTemplatePaths: string[],
): string | undefined {
  if (!step) {
    return undefined
  }

  const currentIndex = canonicalPathRouteTemplatePaths.indexOf(step.routeTemplatePath)

  if (currentIndex <= 0) {
    return undefined
  }

  return canonicalPathRouteTemplatePaths[currentIndex - 1]
}

export default class ReachabilityPathAnalyzer {
  analyze(
    steps: ReachabilityNode[],
    currentStepId: NodeId | undefined,
    defaultEntryRouteTemplatePath: string | undefined,
    resumeActive: boolean,
  ): ReachabilityPathAnalysis {
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
    steps: ReachabilityNode[],
    currentStepId: NodeId | undefined,
    resumeActive: boolean,
    defaultPath: ReachabilityNode[],
    resumePath: ReachabilityNode[] | undefined,
  ): ReachabilityNode[] {
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

  private resolveProgressExists(steps: ReachabilityNode[]): boolean {
    return steps.some(step => step.isReachable && step.hasValidation && step.isValid)
  }

  private resolveResumePath(steps: ReachabilityNode[]): ReachabilityNode[] | undefined {
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

  private resolveProgressDepth(path: ReachabilityNode[]): number {
    let lastProgressIndex = -1

    path.forEach((step, index) => {
      if (step.isReachable && step.hasValidation && step.isValid) {
        lastProgressIndex = index
      }
    })

    return lastProgressIndex
  }

  private resolvePathThroughCurrentStep(currentStepId: NodeId, steps: ReachabilityNode[]): ReachabilityNode[] {
    const currentStep = steps.find(step => step.stepId === currentStepId)

    if (!currentStep?.isReachable) {
      return []
    }

    const pathToCurrent = this.resolvePathToCurrentStep(currentStep, steps)
    const pathFromCurrent = this.resolveForwardPath(currentStep, steps)

    return [...pathToCurrent, ...pathFromCurrent.slice(1)]
  }

  private resolvePathToCurrentStep(step: ReachabilityNode, steps: ReachabilityNode[]): ReachabilityNode[] {
    const stepByRouteTemplatePath = new Map(steps.map(candidate => [candidate.routeTemplatePath, candidate]))
    const path = [step]
    const visited = new Set([step.routeTemplatePath])
    let current = step

    while (!this.isActiveEntry(current) && current.predecessorRouteTemplatePaths.length > 0) {
      const predecessors = current.predecessorRouteTemplatePaths
        .map(routeTemplatePath => stepByRouteTemplatePath.get(routeTemplatePath))
        .filter((candidate): candidate is ReachabilityNode => candidate !== undefined)

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
    steps: ReachabilityNode[],
  ): ReachabilityNode[] {
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

  private resolvePathFromAnchorStep(anchor: ReachabilityNode, steps: ReachabilityNode[]): ReachabilityNode[] {
    if (!anchor.isReachable) {
      return [anchor]
    }

    return this.resolveForwardPath(anchor, steps)
  }

  private resolveForwardPath(start: ReachabilityNode, steps: ReachabilityNode[]): ReachabilityNode[] {
    const stepByRouteTemplatePath = new Map(steps.map(step => [step.routeTemplatePath, step]))
    const path = [start]
    const visited = new Set([start.routeTemplatePath])
    let current = start

    while (current.isValid && current.forwardRouteTemplatePaths.length > 0) {
      const successors = current.forwardRouteTemplatePaths
        .map(routeTemplatePath => stepByRouteTemplatePath.get(routeTemplatePath))
        .filter((candidate): candidate is ReachabilityNode => candidate !== undefined && candidate.isReachable)

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

  private resolveFrontierRouteTemplatePath(path: ReachabilityNode[]): string | undefined {
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

  private isActiveEntry(step: ReachabilityNode): boolean {
    return step.isEntryPoint || step.isConditionalEntry
  }
}
