import type { NavigationRuntimePlan } from '../../../contracts/plans/runtimePlans.type'
import type { JourneyRouteTemplateCatalog } from '../../../contracts/routing/routeTree.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { buildCompiledBaseContext } from '../../context/compiledEvaluationContext'
import { resolveForgeRedirect } from '../../navigation/resolveForgeRedirect'
import { evaluateNavigation } from '../phases/evaluateNavigation'
import type { TerminalPhase } from '../types'

export function createJourneyRedirectTerminal<TOut>(
  navigationPlan: NavigationRuntimePlan,
  routeTemplateCatalog: JourneyRouteTemplateCatalog,
  functionRegistry: FunctionRegistry,
): TerminalPhase<TOut> {
  return {
    name: 'journey-redirect',
    async execute(state) {
      const result = await evaluateNavigation(
        navigationPlan,
        buildCompiledBaseContext(state.context, functionRegistry),
        { routeTemplateCatalog, redirectRule: 'journey-root' },
        state.trace,
      )

      if (result.redirectTarget) {
        return resolveForgeRedirect(result.redirectTarget, state.request)
      }

      throw new Error('No steps found in journey')
    },
  }
}
