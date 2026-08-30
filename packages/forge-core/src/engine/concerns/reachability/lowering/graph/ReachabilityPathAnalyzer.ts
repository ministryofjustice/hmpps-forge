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
    const stepByRouteTemplatePath = new Map(steps.map(step => [step.routeTemplatePath, step]))
    const progressExists = this.resolveProgressExists(steps)
    const defaultPath = this.resolvePathFromAnchorRouteTemplatePath(
      defaultEntryRouteTemplatePath,
      stepByRouteTemplatePath,
    )
    const resumePath = this.resolveResumePath(steps, stepByRouteTemplatePath)
    const canonicalPath = this.resolveCanonicalPath(
      steps,
      currentStepId,
      resumeActive,
      defaultPath,
      resumePath,
      stepByRouteTemplatePath,
    )

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
    stepByRouteTemplatePath: ReadonlyMap<string, ReachabilityNode>,
  ): ReachabilityNode[] {
    if (resumeActive && resumePath) {
      return resumePath
    }

    if (currentStepId !== undefined) {
      const currentStepPath = this.resolvePathThroughCurrentStep(currentStepId, steps, stepByRouteTemplatePath)

      if (currentStepPath.length > 0) {
        return currentStepPath
      }
    }

    return defaultPath
  }

  private resolveProgressExists(steps: ReachabilityNode[]): boolean {
    return steps.some(step => step.isReachable && step.hasValidation && step.isValid)
  }

  private resolveResumePath(
    steps: ReachabilityNode[],
    stepByRouteTemplatePath: ReadonlyMap<string, ReachabilityNode>,
  ): ReachabilityNode[] | undefined {
    const candidates = steps
      .filter(step => this.isActiveEntry(step))
      .map(entry => {
        const path = this.resolvePathFromAnchorStep(entry, stepByRouteTemplatePath)

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

  private resolvePathThroughCurrentStep(
    currentStepId: NodeId,
    steps: ReachabilityNode[],
    stepByRouteTemplatePath: ReadonlyMap<string, ReachabilityNode>,
  ): ReachabilityNode[] {
    const currentStep = steps.find(step => step.stepId === currentStepId)

    if (!currentStep?.isReachable) {
      return []
    }

    const pathToCurrent = this.resolvePathToCurrentStep(currentStep, stepByRouteTemplatePath)
    const pathFromCurrent = this.resolveForwardPath(currentStep, stepByRouteTemplatePath)

    return [...pathToCurrent, ...pathFromCurrent.slice(1)]
  }

  private resolvePathToCurrentStep(
    step: ReachabilityNode,
    stepByRouteTemplatePath: ReadonlyMap<string, ReachabilityNode>,
  ): ReachabilityNode[] {
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
    stepByRouteTemplatePath: ReadonlyMap<string, ReachabilityNode>,
  ): ReachabilityNode[] {
    if (!anchorRouteTemplatePath) {
      return []
    }

    const anchor = stepByRouteTemplatePath.get(anchorRouteTemplatePath)

    if (!anchor) {
      return []
    }

    if (!anchor.isReachable) {
      return [anchor]
    }

    return this.resolvePathFromAnchorStep(anchor, stepByRouteTemplatePath)
  }

  private resolvePathFromAnchorStep(
    anchor: ReachabilityNode,
    stepByRouteTemplatePath: ReadonlyMap<string, ReachabilityNode>,
  ): ReachabilityNode[] {
    if (!anchor.isReachable) {
      return [anchor]
    }

    return this.resolveForwardPath(anchor, stepByRouteTemplatePath)
  }

  private resolveForwardPath(
    start: ReachabilityNode,
    stepByRouteTemplatePath: ReadonlyMap<string, ReachabilityNode>,
  ): ReachabilityNode[] {
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
