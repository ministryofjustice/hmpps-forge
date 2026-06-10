import type { NavigationRedirectRule } from '../../../contracts/navigation/navigationEvaluation.type'
import type { NavigationRuntimePlan } from '../../../contracts/plans/runtimePlans.type'
import type { NodeId } from '../../../contracts/ast/engine.type'
import type { JourneyRouteTemplateCatalog } from '../../../contracts/routing/routeTree.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { buildCompiledBaseContext } from '../../context/compiledEvaluationContext'
import { evaluateNavigation } from './evaluateNavigation'
import type { RequestPhase } from '../types'

export function createNavigationPhase(
  navigationPlan: NavigationRuntimePlan,
  currentStepId: NodeId,
  routeTemplateCatalog: JourneyRouteTemplateCatalog,
  redirectRule: NavigationRedirectRule,
  functionRegistry: FunctionRegistry,
): RequestPhase {
  return {
    name: 'navigation',
    async execute(state) {
      const result = await evaluateNavigation(
        navigationPlan,
        buildCompiledBaseContext(state.context, functionRegistry),
        {
          currentStepId,
          routeTemplateCatalog,
          params: state.context.request.getParams(),
          redirectRule,
        },
        state.trace,
      )

      if (result.reachability !== undefined) {
        state.context.global.reachability = result.reachability
      }

      state.navigationEvaluation = result.evaluation

      if (result.redirectTarget) {
        const reason = result.evaluation.resumeOutcome === 'redirect' ? 'resume' : 'unreachable'

        return { action: 'halt-redirect', target: result.redirectTarget, reason }
      }

      return { action: 'continue' }
    },
  }
}
