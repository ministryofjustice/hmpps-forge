import { buildCompiledNavigationContext } from '../context/compiledEvaluationContext'
import { resolveRedirect } from '../phases/reachability/navigationRedirects'
import { isStepValid } from '../phases/validation/stepValidity'
import { captureContextSnapshot } from '../work/tracing/contextSnapshot'
import type {
  WorkBegin,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/runtime/work.type'
import type { RequestReachabilityWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type {
  ReachabilityFactsInput,
  ReachabilityStateInput,
} from '../../../contracts/navigation/generatedReachabilityEvaluation.type'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { ReachabilityEvaluation } from '../../../contracts/navigation/reachabilityEvaluation.type'
import type { StepValidityResult } from '../../../contracts/runtime/stepValidityResult.type'
import type { PhaseWorkOutput, RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'

export const REQUEST_REACHABILITY_KIND = 'request.reachability'

// Reachability reads navigation-mode validity: non-submission, default group, so
// `submissionOnly` and off-default failures never gate forward reachability.
const NAVIGATION_VALIDITY_FILTER = { isSubmission: false, groups: ['default'] }

export const REQUEST_REACHABILITY_WORK_INSTRUMENTATION: WorkInstrumentation<
  RequestReachabilityWorkProps,
  PhaseWorkOutput
> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestExecutionContext, RequestReachabilityWorkProps>) {
    return {
      currentStepId: ctx.request.currentStepId,
      mode: ctx.props.mode,
      stepCount: ctx.props.routeTemplateCatalog.routeTemplatePathByStepId.size,
      hasParams: ctx.request.context.request.params !== undefined,
    }
  },

  resolveTraceMetadataAtFinish(ctx: WorkContextContract<RequestExecutionContext, RequestReachabilityWorkProps>) {
    const evaluation = ctx.request.reachabilityEvaluation

    return {
      ...captureContextSnapshot(ctx.request.context),
      resumeOutcome: evaluation?.resumeOutcome,
      resumeActive: evaluation?.resumeActive,
      reachableSteps: evaluation?.steps.filter(step => step.isReachable).length,
      defaultEntryRouteTemplatePath: evaluation?.defaultEntryRouteTemplatePath,
      frontierRouteTemplatePath: evaluation?.frontierRouteTemplatePath,
      hasReachabilityProjection: ctx.request.context.evaluation.reachability !== undefined,
    }
  },
}

/**
 * The reachability phase, for both step and journey requests. It evaluates the
 * compiled reachability facts (the dynamic expressions, plus field inventory for
 * step requests), runs the compiled reachability state function over them (graph
 * walk, path/frontier/resume), stores the evaluation and its projection on the
 * shared context, then resolves the redirect: step mode redirects when the
 * requested step is unreachable or a resume should jump to the frontier, else
 * continues to the `answer-cleardown` phase and on to render; journey mode always
 * redirects to the journey's first reachable step.
 */
export const REQUEST_REACHABILITY_WORK_HANDLER: WorkHandler<'request.reachability', RequestReachabilityWorkProps> = {
  kind: REQUEST_REACHABILITY_KIND,

  async begin(
    ctx: WorkContextContract<RequestExecutionContext, RequestReachabilityWorkProps>,
  ): Promise<WorkBegin<'request.reachability'>> {
    const { compiledReachabilityFacts, compiledReachabilityState } = ctx.props

    const navigationContext = buildCompiledNavigationContext(ctx.request.context, ctx.request.functionRegistry)
    const stepValidities = toNavigationValidities(ctx.request.context.evaluation.stepValidities)
    const params = ctx.request.context.request.params
    const factsInput: ReachabilityFactsInput = ctx.props.mode === 'journey' ? {} : { params }

    const facts = await compiledReachabilityFacts(navigationContext, factsInput)

    const stateInput: ReachabilityStateInput =
      ctx.props.mode === 'journey'
        ? { facts, routeTemplateCatalog: ctx.props.routeTemplateCatalog, stepValidities }
        : {
            facts,
            currentStepId: ctx.request.currentStepId,
            routeTemplateCatalog: ctx.props.routeTemplateCatalog,
            stepValidities,
            params,
          }

    const result = compiledReachabilityState(stateInput)

    if (result.reachability !== undefined) {
      ctx.request.context.evaluation.reachability = result.reachability
    }

    ctx.request.reachabilityEvaluation = result.evaluation

    return { output: resolvePhaseOutput(result.evaluation, ctx.props) }
  },
}

function resolvePhaseOutput(evaluation: ReachabilityEvaluation, props: RequestReachabilityWorkProps): PhaseWorkOutput {
  const redirectTarget = resolveRedirect(evaluation, props.mode, props.method)

  if (props.mode === 'journey') {
    if (!redirectTarget) {
      throw new Error('No steps found in journey')
    }

    return { action: 'halt-redirect', target: redirectTarget, reason: 'journey-redirect' }
  }

  if (redirectTarget) {
    const reason = evaluation.resumeOutcome === 'redirect' ? 'resume' : 'unreachable'

    return { action: 'halt-redirect', target: redirectTarget, reason }
  }

  return { action: 'continue' }
}

function toNavigationValidities(
  stepValidities: ReadonlyMap<NodeId, StepValidityResult> | undefined,
): Map<NodeId, boolean> {
  const navigationValidities = new Map<NodeId, boolean>()

  stepValidities?.forEach((result, stepId) => {
    navigationValidities.set(stepId, isStepValid(result, NAVIGATION_VALIDITY_FILTER))
  })

  return navigationValidities
}
