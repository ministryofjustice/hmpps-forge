import createHttpError from 'http-errors'
import type { NavigationRuntimePlan } from '../../../contracts/plans/runtimePlans.type'
import type { JourneyRouteTemplateCatalog } from '../../../contracts/routing/routeTree.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { CompiledNavigationFunction } from '../../../contracts/compiled/compiledFunctions.type'
import { resolveJourneyRootRedirect } from '../../navigation/navigationRedirects'
import { buildCompiledBaseContext } from '../../context/compiledEvaluationContext'
import { resolvePathParams } from '../../../../framework/path/routePath'
import { resolveRedirectTarget } from '../../navigation/redirectTarget'
import type { TerminalPhase } from '../types'

export function createJourneyRedirectTerminal(
  compiledNavigation: CompiledNavigationFunction | undefined,
  navigationPlan: NavigationRuntimePlan,
  routeTemplateCatalog: JourneyRouteTemplateCatalog,
  functionRegistry: FunctionRegistry,
): TerminalPhase {
  return {
    name: 'journey-redirect',
    async execute(state) {
      if (!compiledNavigation) {
        throw new Error('[Forge] Navigation compilation is required — compiledNavigation function is missing from plan')
      }

      const { evaluation } = await compiledNavigation(buildCompiledBaseContext(state.context, functionRegistry), {
        plan: navigationPlan,
        routeTemplateCatalog,
      })

      const redirectRouteTemplatePath = resolveJourneyRootRedirect(evaluation)

      if (redirectRouteTemplatePath) {
        const withParams = resolvePathParams(redirectRouteTemplatePath, state.request.getParams())
        const resolved = resolveRedirectTarget(withParams, state.request.location)

        return { type: 'redirect', url: resolved.value }
      }

      throw createHttpError(500, 'No steps found in journey')
    },
  }
}
