import type { NavigationRuntimeEntry, NavigationRuntimePlan } from '../../../../types/runtimePlans.type'
import { pickTieBreakerWinner } from './NavigationPathAnalyzer'
import { JourneyRouteTemplateCatalog } from '../../../../runtime/types/routes.type'
import { NodeId } from '../../../../types/ast.type'
import { NavigationStepState } from '../../../../types/NavigationEvaluation.type'
import type { ValidationContext } from '../../phase-compilers/validation/StepValidationCompiler'
import type { CompiledReachabilityResult } from '../../phase-compilers/reachability/ReachabilityCompiler'
import { resolveRouteTemplateTargetPath } from './routeTemplateTargetResolver'

/**
 * Builds the reachability state for a journey.
 *
 * Entry predicates, forward outcomes, tie-breaker priorities, and step
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
    const steps = this.createStepStates(plan.entries, routeTemplateCatalog)

    if (plan.reachabilityDisabled) {
      steps.forEach(step => {
        step.isReachable = true
      })

      this.applyCompiledTieBreakers(steps, compiledResult)

      return steps
    }

    this.seedEntryPointsFromCompiled(steps, plan.entries, compiledResult)
    await this.walkReachabilityGraph(
      steps,
      plan,
      routeTemplateCatalog,
      compiledResult,
      currentStepId,
      validationContext,
    )
    this.applyCompiledTieBreakers(steps, compiledResult)

    return steps
  }

  private createStepStates(
    entries: NavigationRuntimeEntry[],
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
  ): NavigationStepState[] {
    return entries.map((entry, declarationIndex) => {
      const routeTemplatePath = routeTemplateCatalog.routeTemplatePathByStepId.get(entry.stepId)

      if (!routeTemplatePath) {
        throw new Error(`Route template path missing for step ${entry.stepId}`)
      }

      return {
        stepId: entry.stepId,
        routeTemplatePath,
        code: entry.code,
        declarationIndex,
        isEntryPoint: entry.isEntryPoint,
        isConditionalEntry: false,
        hasValidation: entry.hasValidation,
        isReachable: false,
        isValid: true,
        forwardRouteTemplatePaths: [],
        predecessorRouteTemplatePaths: [],
      }
    })
  }

  private seedEntryPointsFromCompiled(
    steps: NavigationStepState[],
    entries: NavigationRuntimeEntry[],
    compiled: CompiledReachabilityResult,
  ): void {
    entries.forEach((entry, index) => {
      if (entry.isEntryPoint) {
        steps[index].isReachable = true
      }

      if (compiled.entryResults[index] === true) {
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
    const routeTemplatePaths: string[] = []

    for (const outcomeStr of outcomeStrings) {
      if (outcomeStr === undefined) {
        continue
      }

      const routeTemplatePath = resolveRouteTemplateTargetPath(outcomeStr, currentRouteTemplatePath)

      if (routeTemplatePath === undefined || !routeTemplateCatalog.stepIdByRouteTemplatePath.has(routeTemplatePath)) {
        continue
      }

      if (!routeTemplatePaths.includes(routeTemplatePath)) {
        routeTemplatePaths.push(routeTemplatePath)
      }
    }

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

    const stepValidations = plan.compiledStepValidations

    const entryByStepId = new Map(plan.entries.map(entry => [entry.stepId, entry]))
    const stepIndexByStepId = new Map(plan.entries.map((entry, idx) => [entry.stepId, idx]))
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

      const entry = entryByStepId.get(current.stepId)

      if (!entry) {
        continue
      }

      const shouldEvaluateCurrentStep = current.stepId !== currentStepId || resumeConfigured

      if (!shouldEvaluateCurrentStep) {
        continue
      }

      if (entry.hasValidation) {
        const compiledValidation = stepValidations.get(current.stepId)

        if (!compiledValidation) {
          throw new Error(`[Forge] Compiled validation missing for step "${current.stepId}"`)
        }

        const validationResult = await compiledValidation(validationCtx, false, ['default'])

        current.isValid = validationResult.isValid
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
