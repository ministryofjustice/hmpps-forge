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

      if (result.reachability !== undefined) {
        state.context.global.reachability = result.reachability
      }

      state.navigationEvaluation = result.evaluation

      const redirectTarget = resolveRedirect(result.evaluation)

      if (redirectTarget) {
        return { action: 'halt-redirect', target: redirectTarget }
      }

      return { action: 'continue' }
    },
  }
}
