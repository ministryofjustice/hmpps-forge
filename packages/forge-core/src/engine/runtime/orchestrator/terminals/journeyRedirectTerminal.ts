import createHttpError from 'http-errors'
import type { NavigationRuntimePlan } from '../../../contracts/plans/runtimePlans.type'
import type { JourneyRouteTemplateCatalog } from '../../../contracts/routing/routeTree.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { buildCompiledBaseContext } from '../../context/compiledEvaluationContext'
import { resolvePathParams } from '../../../../framework/path/routePath'
import { resolveRedirectTarget } from '../../navigation/redirectTarget'
import { evaluateNavigation } from '../phases/evaluateNavigation'
import type { TerminalPhase } from '../types'

export function createJourneyRedirectTerminal(
  navigationPlan: NavigationRuntimePlan,
  routeTemplateCatalog: JourneyRouteTemplateCatalog,
  functionRegistry: FunctionRegistry,
): TerminalPhase {
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
        const withParams = resolvePathParams(result.redirectTarget, state.request.getParams())
        const resolved = resolveRedirectTarget(withParams, state.request.location)

        return { type: 'redirect', url: resolved.value }
      }

      throw createHttpError(500, 'No steps found in journey')
    },
  }
}
