import { buildCompiledReachabilityContext } from '../../../runtime/evaluation/context/compiledEvaluationContext'
import { resolveRedirect } from './reachabilityRedirects'
import { isStepValid } from '../../validation/runtime/stepValidity'
import { captureContextSnapshot } from '../../../runtime/evaluation/work/tracing/contextSnapshot'
import type {
  WorkBegin,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/runtime/work.type'
import type { RequestReachabilityWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { ReachabilityFactsInput, ReachabilityStateInput } from '../contracts/generatedReachabilityEvaluation.type'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { ReachabilityEvaluation } from '../contracts/reachabilityEvaluation.type'
import type { StepValidityResult } from '../../validation/contracts/stepValidityResult.type'
import type { PhaseWorkOutput, RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import ForgeInternalError from '../../../errors/ForgeInternalError'

const REQUEST_REACHABILITY_KIND = 'request.reachability'

// Reachability reads each step's non-submission, default-group validity, so
// `submissionOnly` and off-default failures never gate forward reachability.
const REACHABILITY_VALIDITY_FILTER = { isSubmission: false, groups: ['default'] }

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

    const reachabilityContext = buildCompiledReachabilityContext(ctx.request.context, ctx.request.functionRegistry)
    const stepValidities = toReachabilityValidities(ctx.request.context.evaluation.stepValidities)
    const params = ctx.request.context.request.params
    const factsInput: ReachabilityFactsInput = ctx.props.mode === 'journey' ? {} : { params }

    const facts = await compiledReachabilityFacts(reachabilityContext, factsInput)

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
      throw new ForgeInternalError('No steps found in journey')
    }

    return { action: 'halt-redirect', target: redirectTarget, reason: 'journey-redirect' }
  }

  if (redirectTarget) {
    const reason = evaluation.resumeOutcome === 'redirect' ? 'resume' : 'unreachable'

    return { action: 'halt-redirect', target: redirectTarget, reason }
  }

  return { action: 'continue' }
}

function toReachabilityValidities(
  stepValidities: ReadonlyMap<NodeId, StepValidityResult> | undefined,
): Map<NodeId, boolean> {
  const reachabilityValidities = new Map<NodeId, boolean>()

  stepValidities?.forEach((result, stepId) => {
    reachabilityValidities.set(stepId, isStepValid(result, REACHABILITY_VALIDITY_FILTER))
  })

  return reachabilityValidities
}
