import { buildCompiledNavigationContext } from '../context/compiledEvaluationContext'
import { REACHABILITY_EVALUATION_KIND } from '../phases/reachability/ReachabilityEvaluationWorkHandler'
import { resolveRedirect } from '../phases/reachability/navigationRedirects'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/runtime/work.type'
import { singleChildOutput } from '../work/workTask'
import { phaseInstrumentation, runTaskPhase } from './requestPhase'
import type { RequestReachabilityWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { PhaseWorkOutput, RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'

export const REQUEST_REACHABILITY_KIND = 'request.reachability'

export const REQUEST_REACHABILITY_WORK_INSTRUMENTATION: WorkInstrumentation<
  RequestReachabilityWorkProps,
  PhaseWorkOutput
> = phaseInstrumentation()

/**
 * The reachability phase, for both step and journey requests. `begin` builds the
 * navigation context locally and runs the compiled navigation evaluation (its
 * reachability walk reads the precomputed step validities filled by the eager
 * `validities` phase and builds the reachability graph in one pass). `complete` stores
 * the evaluation and its reachability projection on the shared context, then resolves
 * the redirect: step mode redirects when the requested step is unreachable or a resume
 * should jump to the frontier, else continues to the `answer-cleardown` phase and on
 * to render; journey mode always redirects to the journey's first reachable step.
 */
export const REQUEST_REACHABILITY_WORK_HANDLER: WorkHandler<'request.reachability', RequestReachabilityWorkProps> = {
  kind: REQUEST_REACHABILITY_KIND,

  async begin(ctx: WorkContextContract<RequestExecutionContext, RequestReachabilityWorkProps>) {
    if (!ctx.props.compiledNavigation) {
      throw new Error('[Forge] Navigation compilation is required — compiledNavigation function is missing from plan')
    }

    const navigationContext = buildCompiledNavigationContext(ctx.request.context, ctx.request.functionRegistry)
    const stepValidities = ctx.request.context.evaluation.stepValidities ?? new Map()
    const input =
      ctx.props.mode === 'journey'
        ? { plan: ctx.props.navigationPlan, routeTemplateCatalog: ctx.props.routeTemplateCatalog, stepValidities }
        : {
            plan: ctx.props.navigationPlan,
            currentStepId: ctx.request.currentStepId,
            routeTemplateCatalog: ctx.props.routeTemplateCatalog,
            params: ctx.request.context.request.params,
            stepValidities,
          }

    return runTaskPhase(
      ctx.props.compiledNavigation(navigationContext, input),
      REACHABILITY_EVALUATION_KIND,
      'Compiled navigation returned an invalid work task',
    )
  },

  complete(
    ctx: WorkContextContract<RequestExecutionContext, RequestReachabilityWorkProps>,
    children: readonly CompletedWork[],
  ): PhaseWorkOutput {
    const result = singleChildOutput(children, REACHABILITY_EVALUATION_KIND)

    if (result === undefined) {
      throw new Error('Navigation work task completed with an invalid navigation result')
    }

    if (result.reachability !== undefined) {
      ctx.request.context.evaluation.reachability = result.reachability
    }

    ctx.request.reachabilityEvaluation = result.evaluation

    const redirectTarget = resolveRedirect(result.evaluation, ctx.props.mode, ctx.props.method)

    if (ctx.props.mode === 'journey') {
      if (!redirectTarget) {
        throw new Error('No steps found in journey')
      }

      return { action: 'halt-redirect', target: redirectTarget, reason: 'journey-redirect' }
    }

    if (redirectTarget) {
      const reason = result.evaluation.resumeOutcome === 'redirect' ? 'resume' : 'unreachable'

      return { action: 'halt-redirect', target: redirectTarget, reason }
    }

    return { action: 'continue' }
  },
}
