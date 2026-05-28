import type { ForgeInstrumentation } from '../../../../instrumentation/ForgeInstrumentation'
import type { ForgeSpanAttributes } from '../../../../instrumentation/types'
import type { NavigationEvaluation, NavigationStepState } from '../../../types/NavigationEvaluation.type'
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
        const reachableCount = evaluation.steps.filter(s => s.isReachable).length

        span.setAttributes({
          'forge.navigation.currentStepId': evaluation.currentStepId ?? '',
          'forge.navigation.defaultEntry': evaluation.defaultEntryRouteTemplatePath ?? '',
          'forge.navigation.frontier': evaluation.frontierRouteTemplatePath ?? '',
          'forge.navigation.canonicalPath': evaluation.canonicalPathRouteTemplatePaths,
          'forge.navigation.progressExists': evaluation.progressExists,
          'forge.navigation.resumeActive': evaluation.resumeActive,
          'forge.navigation.resumeOutcome': evaluation.resumeOutcome,
          'forge.navigation.reachableCount': reachableCount,
          'forge.navigation.unreachableCount': evaluation.steps.length - reachableCount,
        })

        evaluation.steps.forEach(step => {
          span.addEvent('forge.navigation.step', stepEventAttributes(step))
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

function stepEventAttributes(step: NavigationStepState): ForgeSpanAttributes {
  return {
    'forge.navigation.step.id': step.stepId,
    'forge.navigation.step.routeTemplatePath': step.routeTemplatePath,
    'forge.navigation.step.declarationIndex': step.declarationIndex,
    'forge.navigation.step.isEntryPoint': step.isEntryPoint,
    'forge.navigation.step.isConditionalEntry': step.isConditionalEntry,
    'forge.navigation.step.hasValidation': step.hasValidation,
    'forge.navigation.step.isReachable': step.isReachable,
    'forge.navigation.step.isValid': step.isValid,
    'forge.navigation.step.forwardRouteTemplatePaths': step.forwardRouteTemplatePaths,
    'forge.navigation.step.predecessorRouteTemplatePaths': step.predecessorRouteTemplatePaths,
    ...(step.code !== undefined && { 'forge.navigation.step.code': step.code }),
    ...(step.declaredForwardRouteTemplatePaths !== undefined && {
      'forge.navigation.step.declaredForwardRouteTemplatePaths': step.declaredForwardRouteTemplatePaths,
    }),
    ...(step.tieBreakerPriority !== undefined && {
      'forge.navigation.step.tieBreakerPriority': step.tieBreakerPriority,
    }),
  }
}
