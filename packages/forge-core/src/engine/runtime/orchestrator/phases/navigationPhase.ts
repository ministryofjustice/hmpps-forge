import type { NavigationEvaluation } from '../../../contracts/navigation/navigationEvaluation.type'
import type { NavigationRuntimePlan } from '../../../contracts/plans/runtimePlans.type'
import type { NodeId } from '../../../contracts/ast/engine.type'
import type { JourneyRouteTemplateCatalog } from '../../../contracts/routing/routeTree.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { CompiledNavigationFunction } from '../../../contracts/compiled/compiledFunctions.type'
import { buildCompiledBaseContext } from '../../context/compiledEvaluationContext'
import type TraceRecorder from '../trace/TraceRecorder'
import type { RequestPhase } from '../types'

export function createNavigationPhase(
  compiledNavigation: CompiledNavigationFunction | undefined,
  navigationPlan: NavigationRuntimePlan,
  currentStepId: NodeId,
  routeTemplateCatalog: JourneyRouteTemplateCatalog,
  resolveRedirect: (evaluation: NavigationEvaluation) => string | undefined,
  functionRegistry: FunctionRegistry,
): RequestPhase {
  return {
    name: 'navigation',
    async execute(state) {
      if (!compiledNavigation) {
        throw new Error('[Forge] Navigation compilation is required — compiledNavigation function is missing from plan')
      }

      const startedAt = performance.now()
      const result = await compiledNavigation(buildCompiledBaseContext(state.context, functionRegistry), {
        plan: navigationPlan,
        currentStepId,
        routeTemplateCatalog,
        params: state.context.request.getParams(),
      })

      const durationMs = performance.now() - startedAt

      if (result.reachability !== undefined) {
        state.context.global.reachability = result.reachability
      }

      state.navigationEvaluation = result.evaluation

      const redirectTarget = resolveRedirect(result.evaluation)

      recordNavigationTrace(state.trace, result.evaluation, redirectTarget, durationMs)

      if (redirectTarget) {
        const reason = result.evaluation.resumeOutcome === 'redirect' ? 'resume' : 'unreachable'

        return { action: 'halt-redirect', target: redirectTarget, reason }
      }

      return { action: 'continue' }
    },
  }
}

/**
 * Records one navigation evaluation's verdicts: one unit per journey step with
 * its reachability verdict, in declaration order, then the resolution unit
 * carrying the resume outcome and the redirect target chosen — absent when
 * navigation let the request continue. The compiled navigation function never
 * sees the recorder; the verdicts are read off the evaluation it returned.
 * Also used by the journey-redirect terminal, which runs the same evaluation
 * to pick the journey root's redirect target.
 */
export function recordNavigationTrace(
  trace: TraceRecorder | undefined,
  evaluation: NavigationEvaluation,
  redirect: string | undefined,
  durationMs: number,
): void {
  if (!trace) {
    return
  }

  evaluation.steps.forEach(step => {
    trace.record({
      kind: 'navigation-step',
      nodeId: step.stepId,
      isReachable: step.isReachable,
      isValid: step.isValid,
    })
  })

  trace.record({
    kind: 'navigation-resolution',
    resumeOutcome: evaluation.resumeOutcome,
    redirect,
    durationMs,
  })
}
