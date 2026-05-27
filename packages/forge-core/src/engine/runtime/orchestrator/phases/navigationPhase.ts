import type { ForgeInstrumentation } from '../../../../instrumentation/ForgeInstrumentation'
import type { NavigationEvaluation } from '../../../types/NavigationEvaluation.type'
import type { NavigationRuntimePlan } from '../../../types/runtimePlans.type'
import type { NodeId } from '../../../types/engine.type'
import type { JourneyRouteTemplateCatalog } from '../../types/routes.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { CompiledNavigationFunction } from '../../../compilation/codegen/phase-compilers/reachability/ReachabilityCompiler'
import { buildCompiledBaseContext } from '../../context/compiledEvaluationContext'
import type { RequestPhase } from '../types'

export function createNavigationPhase(
  compiledNavigation: CompiledNavigationFunction | undefined,
  navigationPlan: NavigationRuntimePlan,
  currentStepId: NodeId,
  routeTemplateCatalog: JourneyRouteTemplateCatalog,
  resolveRedirect: (evaluation: NavigationEvaluation) => string | undefined,
  functionRegistry: FunctionRegistry,
  instrumentation: ForgeInstrumentation,
): RequestPhase {
  return {
    name: 'navigation',
    async execute(state) {
      if (!compiledNavigation) {
        throw new Error('[Forge] Navigation compilation is required — compiledNavigation function is missing from plan')
      }

      const result = await compiledNavigation(buildCompiledBaseContext(state.context, functionRegistry), {
        plan: navigationPlan,
        currentStepId,
        routeTemplateCatalog,
        params: state.context.request.getParams(),
      })

      instrumentation.span('reachability', span => {
        const { evaluation } = result

        span.setAttributes({
          'forge.navigation.currentStepId': evaluation.currentStepId ?? '',
          'forge.navigation.defaultEntry': evaluation.defaultEntryRouteTemplatePath ?? '',
          'forge.navigation.frontier': evaluation.frontierRouteTemplatePath ?? '',
          'forge.navigation.canonicalPath': evaluation.canonicalPathRouteTemplatePaths,
          'forge.navigation.progressExists': evaluation.progressExists,
          'forge.navigation.resumeActive': evaluation.resumeActive,
          'forge.navigation.resumeOutcome': evaluation.resumeOutcome,
          'forge.navigation.reachableCount': evaluation.steps.filter(s => s.isReachable).length,
          'forge.navigation.unreachableCount': evaluation.steps.filter(s => !s.isReachable).length,
          'forge.navigation.graph': JSON.stringify(evaluation.steps),
        })
      })

      if (result.reachability !== undefined) {
        state.context.global.reachability = result.reachability
      }

      state.navigationEvaluation = result.evaluation

      const redirectTarget = resolveRedirect(result.evaluation)

      if (redirectTarget) {
        const reason = result.evaluation.resumeOutcome === 'redirect' ? 'resume' : 'unreachable'

        return { action: 'halt-redirect', target: redirectTarget, reason }
      }

      return { action: 'continue' }
    },
  }
}
