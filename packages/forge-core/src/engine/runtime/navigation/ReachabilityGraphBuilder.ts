import type { CompiledNavigationStep, NavigationRuntimePlan } from '../../contracts/plans/runtimePlans.type'
import { pickTieBreakerWinner } from './NavigationPathAnalyzer'
import { JourneyRouteTemplateCatalog } from '../../contracts/routing/routeTree.type'
import { NodeId } from '../../contracts/ast/ast.type'
import { NavigationStepState } from '../../contracts/navigation/navigationEvaluation.type'
import type { ValidationContext } from '../../contracts/compiled/phaseContexts.type'
import type { CompiledReachabilityResult } from '../../contracts/compiled/compiledFunctions.type'
import { resolveRouteTemplateTargetPath } from './routeTemplateTargetResolver'
import { evaluateValidation } from '../orchestrator/phases/evaluateValidation'

/**
 * Builds the reachability state for a journey.
 *
 * EntryWhen predicates, forward outcomes, tie-breaker priorities, and step
 * validation determine which steps are reachable.
 */
export default class ReachabilityGraphBuilder {
  async build(
    plan: NavigationRuntimePlan,
    currentStepId: NodeId | undefined,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
    validationContext: ValidationContext,
    compiledResult: CompiledReachabilityResult,
  ): Promise<NavigationStepState[]> {
    const steps = this.createStepStates(plan.navigationSteps, routeTemplateCatalog)

    if (plan.reachabilityDisabled) {
      steps.forEach(step => {
        step.isReachable = true
      })

      this.populateDeclaredForwardPaths(steps, compiledResult, routeTemplateCatalog)
      this.applyCompiledTieBreakers(steps, compiledResult)

      return steps
    }

    this.seedEntryPointsFromCompiled(steps, plan.navigationSteps, compiledResult)
    await this.walkReachabilityGraph(
      steps,
      plan,
      routeTemplateCatalog,
      compiledResult,
      currentStepId,
      validationContext,
    )
    this.populateUnvisitedForwardPaths(steps, compiledResult, routeTemplateCatalog)
    this.populateDeclaredForwardPaths(steps, compiledResult, routeTemplateCatalog)
    this.applyCompiledTieBreakers(steps, compiledResult)

    return steps
  }

  private createStepStates(
    compiledSteps: readonly CompiledNavigationStep[],
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
  ): NavigationStepState[] {
    return compiledSteps.map((compiledStep, declarationIndex) => {
      const routeTemplatePath = routeTemplateCatalog.routeTemplatePathByStepId.get(compiledStep.nodeId)

      if (!routeTemplatePath) {
        throw new Error(`Route template path missing for step ${compiledStep.nodeId}`)
      }

      return {
        stepId: compiledStep.nodeId,
        routeTemplatePath,
        code: compiledStep.code,
        declarationIndex,
        isEntryPoint: compiledStep.isEntryPoint,
        isConditionalEntry: false,
        hasValidation: compiledStep.hasValidation,
        isReachable: false,
        isValid: true,
        forwardRouteTemplatePaths: [],
        declaredForwardRouteTemplatePaths: [],
        predecessorRouteTemplatePaths: [],
        fieldFailures: [],
        domainFailures: [],
      }
    })
  }

  private seedEntryPointsFromCompiled(
    steps: NavigationStepState[],
    compiledSteps: readonly CompiledNavigationStep[],
    compiled: CompiledReachabilityResult,
  ): void {
    compiledSteps.forEach((compiledStep, index) => {
      if (compiledStep.isEntryPoint) {
        steps[index].isReachable = true
      }

      if (compiled.entryWhenResults[index] === true) {
        steps[index].isReachable = true
        steps[index].isConditionalEntry = true
      }
    })
  }

  /**
   * Reads raw outcome path strings from the compiled result and resolves them as
   * route-template paths before checking they point at known journey steps.
   */
  private resolveForwardPathsFromCompiled(
    currentRouteTemplatePath: string,
    stepIndex: number,
    compiled: CompiledReachabilityResult,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
  ): string[] {
    const outcomeStrings = compiled.outcomeValues[stepIndex] ?? []

    return this.resolveRouteTemplatePaths(outcomeStrings, currentRouteTemplatePath, routeTemplateCatalog)
  }

  private resolveDeclaredForwardPathsFromCompiled(
    currentRouteTemplatePath: string,
    stepIndex: number,
    compiled: CompiledReachabilityResult,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
  ): string[] {
    const declaredOutcomeStrings = compiled.declaredOutcomeValues[stepIndex] ?? []

    if (declaredOutcomeStrings.length === 0) {
      return this.resolveForwardPathsFromCompiled(currentRouteTemplatePath, stepIndex, compiled, routeTemplateCatalog)
    }

    return this.resolveRouteTemplatePaths(declaredOutcomeStrings, currentRouteTemplatePath, routeTemplateCatalog)
  }

  private resolveRouteTemplatePaths(
    outcomeStrings: readonly (string | undefined)[],
    currentRouteTemplatePath: string,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
  ): string[] {
    const routeTemplatePaths: string[] = []

    outcomeStrings.forEach(outcomeStr => {
      if (outcomeStr === undefined) {
        return
      }

      const routeTemplatePath = resolveRouteTemplateTargetPath(outcomeStr, currentRouteTemplatePath)

      if (routeTemplatePath === undefined || !routeTemplateCatalog.stepIdByRouteTemplatePath.has(routeTemplatePath)) {
        return
      }

      if (!routeTemplatePaths.includes(routeTemplatePath)) {
        routeTemplatePaths.push(routeTemplatePath)
      }
    })

    return routeTemplatePaths
  }

  private async walkReachabilityGraph(
    steps: NavigationStepState[],
    plan: NavigationRuntimePlan,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
    compiled: CompiledReachabilityResult,
    currentStepId: NodeId | undefined,
    validationCtx: ValidationContext,
  ): Promise<void> {
    if (steps.length === 0) {
      return
    }

    const resumeConfigured = plan.resumeConfigured
    const isCurrentStepAnActiveEntry = steps.some(step => step.isReachable && step.stepId === currentStepId)

    if (!resumeConfigured && isCurrentStepAnActiveEntry) {
      return
    }

    const stepValidationPlans = plan.stepValidationPlans

    const compiledStepByStepId = new Map(plan.navigationSteps.map(step => [step.nodeId, step]))
    const stepIndexByStepId = new Map(plan.navigationSteps.map((step, idx) => [step.nodeId, idx]))
    const stateByRouteTemplatePath = new Map(steps.map(step => [step.routeTemplatePath, step]))
    const visited = new Set<string>()
    const queue = steps.filter(step => step.isReachable).map(step => step.routeTemplatePath)

    while (queue.length > 0) {
      const currentRouteTemplatePath = queue.shift()

      if (currentRouteTemplatePath === undefined || visited.has(currentRouteTemplatePath)) {
        continue
      }

      visited.add(currentRouteTemplatePath)

      const current = stateByRouteTemplatePath.get(currentRouteTemplatePath)

      if (!current) {
        continue
      }

      const compiledStep = compiledStepByStepId.get(current.stepId)

      if (!compiledStep) {
        continue
      }

      const shouldEvaluateCurrentStep = current.stepId !== currentStepId || resumeConfigured

      if (!shouldEvaluateCurrentStep) {
        continue
      }

      if (compiledStep.hasValidation) {
        const validationPlan = stepValidationPlans.get(current.stepId)

        if (!validationPlan) {
          throw new Error(`[Forge] Validation plan missing for step "${current.stepId}"`)
        }

        // No trace recorder on purpose: the step's own pipeline records these
        // units; a reachability re-check would double-record them.
        const validationResult = await evaluateValidation(validationPlan, validationCtx, {
          isSubmission: false,
          groups: ['default'],
        })

        current.isValid = validationResult.isValid
        current.fieldFailures = validationResult.fieldFailures
        current.domainFailures = validationResult.domainFailures
      }

      const entryIndex = stepIndexByStepId.get(current.stepId)!

      current.forwardRouteTemplatePaths = this.resolveForwardPathsFromCompiled(
        current.routeTemplatePath,
        entryIndex,
        compiled,
        routeTemplateCatalog,
      )

      current.forwardRouteTemplatePaths.forEach(forwardRouteTemplatePath => {
        const next = stateByRouteTemplatePath.get(forwardRouteTemplatePath)

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
  }

  private populateUnvisitedForwardPaths(
    steps: NavigationStepState[],
    compiled: CompiledReachabilityResult,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
  ): void {
    const stateByRouteTemplatePath = new Map(steps.map(step => [step.routeTemplatePath, step]))

    steps.forEach((step, index) => {
      if (step.forwardRouteTemplatePaths.length > 0) {
        return
      }

      step.forwardRouteTemplatePaths = this.resolveForwardPathsFromCompiled(
        step.routeTemplatePath,
        index,
        compiled,
        routeTemplateCatalog,
      )

      step.forwardRouteTemplatePaths.forEach(forwardPath => {
        const next = stateByRouteTemplatePath.get(forwardPath)

        if (!next || next.predecessorRouteTemplatePaths.includes(step.routeTemplatePath)) {
          return
        }

        next.predecessorRouteTemplatePaths.push(step.routeTemplatePath)
      })
    })
  }

  private populateDeclaredForwardPaths(
    steps: NavigationStepState[],
    compiled: CompiledReachabilityResult,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
  ): void {
    steps.forEach((step, index) => {
      step.declaredForwardRouteTemplatePaths = this.resolveDeclaredForwardPathsFromCompiled(
        step.routeTemplatePath,
        index,
        compiled,
        routeTemplateCatalog,
      )
    })
  }

  private applyCompiledTieBreakers(steps: NavigationStepState[], compiled: CompiledReachabilityResult): void {
    for (let index = 0; index < steps.length; index++) {
      if (!steps[index].isReachable) {
        continue
      }

      steps[index].tieBreakerPriority = compiled.tieBreakerPriorities[index]
    }
  }

  resolveDefaultEntryRouteTemplatePath(steps: NavigationStepState[]): string | undefined {
    const activeEntries = steps.filter(step => this.isActiveEntry(step))
    const winner = pickTieBreakerWinner(activeEntries)

    if (winner) {
      return winner.routeTemplatePath
    }

    return steps[0]?.routeTemplatePath
  }

  private isActiveEntry(step: NavigationStepState): boolean {
    return step.isEntryPoint || step.isConditionalEntry
  }
}
