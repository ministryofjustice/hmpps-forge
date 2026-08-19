import type { ReachabilityStateTableEntry, ReachabilityStateTable } from '../../contracts/reachabilityModel.type'
import { pickTieBreakerWinner } from './ReachabilityPathAnalyzer'
import type { JourneyRouteTemplateCatalog } from '../../../route/contracts/routeTree.type'
import type { NodeId } from '../../../../chassis/contracts/ast/ast.type'
import type { ReachabilityNode } from '../../contracts/reachabilityEvaluation.type'
import type { CompiledReachabilityResult } from '../../../../chassis/contracts/compiled/compiledFunctions.type'
import { resolveRouteTemplateTargetPath } from './routeTemplateTargetResolver'
import ForgeInternalError from '../../../../errors/ForgeInternalError'

/**
 * Builds the reachability state for a journey: marks entry points as reachable,
 * walks forward from them through the step graph, and resolves each step's
 * forward, declared-forward, and predecessor route-template paths plus its
 * tie-breaker priority.
 *
 * Entry predicates, forward outcomes, and tie-breaker priorities come from the
 * compiled reachability facts. Per-step validity (whether the step's validation
 * passes in non-submission, default-group mode) is read from the `stepValidities`
 * map; a step absent from the map has no validation and is treated as valid. An
 * invalid step doesn't propagate reachability to its successors.
 */
export default class ReachabilityGraphBuilder {
  private steps!: ReachabilityNode[]

  private compiled!: CompiledReachabilityResult

  private routeTemplateCatalog!: JourneyRouteTemplateCatalog

  private stepValidities!: ReadonlyMap<NodeId, boolean>

  private stateByRouteTemplatePath!: Map<string, ReachabilityNode>

  private stepIndexByStepId!: Map<NodeId, number>

  buildReachableSteps(
    plan: ReachabilityStateTable,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
    compiledResult: CompiledReachabilityResult,
    stepValidities: ReadonlyMap<NodeId, boolean>,
  ): ReachabilityNode[] {
    this.compiled = compiledResult
    this.routeTemplateCatalog = routeTemplateCatalog
    this.stepValidities = stepValidities
    this.steps = this.createStepStates(plan.entries)
    this.stateByRouteTemplatePath = new Map(this.steps.map(step => [step.routeTemplatePath, step]))
    this.stepIndexByStepId = new Map(plan.entries.map((entry, index) => [entry.stepId, index]))

    if (plan.reachabilityDisabled) {
      this.steps.forEach(step => {
        step.isReachable = true
      })

      this.populateDeclaredForwardPaths()
      this.applyCompiledTieBreakers()

      return this.steps
    }

    this.seedEntryPoints(plan.entries)
    this.walkReachabilityGraph()
    this.populateUnvisitedForwardPaths()
    this.populateDeclaredForwardPaths()
    this.applyCompiledTieBreakers()

    return this.steps
  }

  resolveDefaultEntryRouteTemplatePath(): string | undefined {
    const activeEntries = this.steps.filter(step => step.isEntryPoint || step.isConditionalEntry)
    const winner = pickTieBreakerWinner(activeEntries)

    if (winner) {
      return winner.routeTemplatePath
    }

    return this.steps[0]?.routeTemplatePath
  }

  private createStepStates(entries: ReachabilityStateTableEntry[]): ReachabilityNode[] {
    return entries.map((entry, declarationIndex) => {
      const routeTemplatePath = this.routeTemplateCatalog.routeTemplatePathByStepId.get(entry.stepId)

      if (!routeTemplatePath) {
        throw new ForgeInternalError(`Route template path missing for step ${entry.stepId}`)
      }

      return {
        stepId: entry.stepId,
        routeTemplatePath,
        code: entry.code,
        declarationIndex,
        isEntryPoint: entry.isEntryPoint,
        isConditionalEntry: false,
        hasValidation: this.stepValidities.has(entry.stepId),
        isReachable: false,
        isValid: true,
        forwardRouteTemplatePaths: [],
        declaredForwardRouteTemplatePaths: [],
        predecessorRouteTemplatePaths: [],
      }
    })
  }

  private seedEntryPoints(entries: ReachabilityStateTableEntry[]): void {
    entries.forEach((entry, index) => {
      if (entry.isEntryPoint) {
        this.steps[index].isReachable = true
      }

      if (this.compiled.entryResults[index] === true) {
        this.steps[index].isReachable = true
        this.steps[index].isConditionalEntry = true
      }
    })
  }

  private walkReachabilityGraph(): void {
    if (this.steps.length === 0) {
      return
    }

    const visited = new Set<string>()
    const queue = this.steps.filter(step => step.isReachable).map(step => step.routeTemplatePath)

    while (queue.length > 0) {
      const current = this.dequeueNextStep(queue, visited)

      if (!current) {
        continue
      }

      this.evaluateStepReachability(current)
      this.propagateToSuccessors(current, queue, visited)
    }
  }

  private dequeueNextStep(queue: string[], visited: Set<string>): ReachabilityNode | undefined {
    const routeTemplatePath = queue.shift()

    if (routeTemplatePath === undefined || visited.has(routeTemplatePath)) {
      return undefined
    }

    visited.add(routeTemplatePath)

    return this.stateByRouteTemplatePath.get(routeTemplatePath)
  }

  private evaluateStepReachability(step: ReachabilityNode): void {
    // Absence from the map means the step has no validation, so it is valid and
    // cannot block forward reachability. The map only carries validity in
    // reachability mode (non-submission, default group), so `submissionOnly`
    // rules and off-default-group failures don't block forward propagation.
    step.isValid = this.stepValidities.get(step.stepId) ?? true

    const entryIndex = this.stepIndexByStepId.get(step.stepId)!

    step.forwardRouteTemplatePaths = this.resolveForwardPaths(step.routeTemplatePath, entryIndex)
  }

  private propagateToSuccessors(current: ReachabilityNode, queue: string[], visited: Set<string>): void {
    current.forwardRouteTemplatePaths.forEach(forwardRouteTemplatePath => {
      const next = this.stateByRouteTemplatePath.get(forwardRouteTemplatePath)

      if (!next) {
        return
      }

      if (!next.predecessorRouteTemplatePaths.includes(current.routeTemplatePath)) {
        next.predecessorRouteTemplatePaths.push(current.routeTemplatePath)
      }

      if (!current.isValid) {
        return
      }

      if (!next.isReachable) {
        next.isReachable = true
      }

      if (!visited.has(next.routeTemplatePath)) {
        queue.push(next.routeTemplatePath)
      }
    })
  }

  private resolveForwardPaths(currentRouteTemplatePath: string, stepIndex: number): string[] {
    const outcomeStrings = this.compiled.outcomeValues[stepIndex] ?? []

    return this.resolveRouteTemplatePaths(outcomeStrings, currentRouteTemplatePath)
  }

  private resolveDeclaredForwardPaths(currentRouteTemplatePath: string, stepIndex: number): string[] {
    const declaredOutcomeStrings = this.compiled.declaredOutcomeValues[stepIndex] ?? []

    if (declaredOutcomeStrings.length === 0) {
      return this.resolveForwardPaths(currentRouteTemplatePath, stepIndex)
    }

    return this.resolveRouteTemplatePaths(declaredOutcomeStrings, currentRouteTemplatePath)
  }

  private resolveRouteTemplatePaths(
    outcomeStrings: readonly (string | undefined)[],
    currentRouteTemplatePath: string,
  ): string[] {
    const routeTemplatePaths: string[] = []

    outcomeStrings.forEach(outcomeStr => {
      if (outcomeStr === undefined) {
        return
      }

      const routeTemplatePath = resolveRouteTemplateTargetPath(outcomeStr, currentRouteTemplatePath)

      if (
        routeTemplatePath === undefined ||
        !this.routeTemplateCatalog.stepIdByRouteTemplatePath.has(routeTemplatePath)
      ) {
        return
      }

      if (!routeTemplatePaths.includes(routeTemplatePath)) {
        routeTemplatePaths.push(routeTemplatePath)
      }
    })

    return routeTemplatePaths
  }

  private populateUnvisitedForwardPaths(): void {
    this.steps.forEach((step, index) => {
      if (step.forwardRouteTemplatePaths.length > 0) {
        return
      }

      step.forwardRouteTemplatePaths = this.resolveForwardPaths(step.routeTemplatePath, index)

      step.forwardRouteTemplatePaths.forEach(forwardPath => {
        const next = this.stateByRouteTemplatePath.get(forwardPath)

        if (!next || next.predecessorRouteTemplatePaths.includes(step.routeTemplatePath)) {
          return
        }

        next.predecessorRouteTemplatePaths.push(step.routeTemplatePath)
      })
    })
  }

  private populateDeclaredForwardPaths(): void {
    this.steps.forEach((step, index) => {
      step.declaredForwardRouteTemplatePaths = this.resolveDeclaredForwardPaths(step.routeTemplatePath, index)
    })
  }

  private applyCompiledTieBreakers(): void {
    for (let index = 0; index < this.steps.length; index++) {
      if (!this.steps[index].isReachable) {
        continue
      }

      this.steps[index].tieBreakerPriority = this.compiled.tieBreakerPriorities[index]
    }
  }
}
