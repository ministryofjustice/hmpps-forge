import { ReachabilityRuntimePlan, ReachabilityStepEntry } from '../../compilation/RuntimePlanBuilder'
import RuntimeEvaluationContext from '../context/RuntimeEvaluationContext'
import { resolveRedirectTarget } from '../navigation/redirectTarget'
import { pickTieBreakerWinner } from '../navigation/NavigationPathAnalyzer'
import { JourneyRouteTemplateCatalog } from '../types/routes.type'
import { NodeId } from '../../types/ast.type'
import { NavigationStepState } from '../types/NavigationEvaluation.type'
import { CompiledReachabilityResult } from '../../compilation/reachability/ReachabilityCompiler'
import type { ValidationContext } from '../../compilation/validation/StepValidationCompiler'
import FunctionRegistry from '../../registries/FunctionRegistry'

/**
 * Builds the reachability graph for a journey using pre-compiled results.
 *
 * Entry predicates, forward outcomes, tie-breaker priorities, and step validation
 * are all resolved from compiled functions — no invoker.invoke() calls during the walk.
 */
export default class ReachabilityGraphBuilder {
  async build(
    plan: ReachabilityRuntimePlan,
    currentStepId: NodeId | undefined,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
    context: RuntimeEvaluationContext,
    compiledResult: CompiledReachabilityResult,
    functionRegistry: FunctionRegistry,
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
      context,
      functionRegistry,
    )
    this.applyCompiledTieBreakers(steps, compiledResult)

    return steps
  }

  private createStepStates(
    entries: ReachabilityStepEntry[],
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
    entries: ReachabilityStepEntry[],
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
   * Reads raw outcome path strings from the compiled result and resolves them
   * through resolveRedirectTarget (for relative URL handling) and the route
   * catalog (to verify the target is a known step). Redirect resolution stays
   * here in TypeScript rather than in the compiled function to avoid duplicating
   * URL parsing logic in generated code.
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

      const resolvedTarget = resolveRedirectTarget(outcomeStr, {
        origin: 'https://forge.local',
        pathname: currentRouteTemplatePath,
      })

      if (!routeTemplateCatalog.stepIdByRouteTemplatePath.has(resolvedTarget.pathname)) {
        continue
      }

      if (!routeTemplatePaths.includes(resolvedTarget.pathname)) {
        routeTemplatePaths.push(resolvedTarget.pathname)
      }
    }

    return routeTemplatePaths
  }

  private async walkReachabilityGraph(
    steps: NavigationStepState[],
    plan: ReachabilityRuntimePlan,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
    compiled: CompiledReachabilityResult,
    currentStepId: NodeId | undefined,
    context: RuntimeEvaluationContext,
    functionRegistry: FunctionRegistry,
  ): Promise<void> {
    if (steps.length === 0) {
      return
    }

    const resumeConfigured = plan.resumeAlways || plan.resumeWhenNodeId !== undefined
    const isCurrentStepAnActiveEntry = steps.some(step => step.isReachable && step.stepId === currentStepId)

    if (!resumeConfigured && isCurrentStepAnActiveEntry) {
      return
    }

    const stepValidations = plan.resolveStepValidations?.()
    const validationCtx = this.buildValidationContext(context, functionRegistry)

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
        const compiledValidation = stepValidations?.get(current.stepId)

        if (!compiledValidation) {
          throw new Error(`[Forge] Compiled validation missing for step "${current.stepId}"`)
        }

        const validationResult = await compiledValidation(validationCtx, false)

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

  private buildValidationContext(
    context: RuntimeEvaluationContext,
    functionRegistry: FunctionRegistry,
  ): ValidationContext {
    return {
      answers: context.global.answers,
      data: context.global.data,
      session: (context.request.getSession() ?? {}) as Record<string, unknown>,
      params: context.request.getParams(),
      query: context.request.getAllQuery(),
      request: {
        url: context.request.url,
        path: context.request.location.pathname,
        method: context.request.method,
        headers: context.request.getAllHeaders(),
        cookies: context.request.getAllCookies(),
        state: context.request.getAllState(),
      },
      conditions: functionRegistry,
      scope: context.scope,
    }
  }
}
