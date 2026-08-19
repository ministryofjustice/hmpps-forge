import { buildCompiledReachabilityContext } from '../../../runtime/context/compiledEvaluationContext'
import { resolveRedirect } from './reachabilityRedirects'
import { captureContextSnapshot } from '../../../runtime/pipeline/contextSnapshot'
import { createWorkTask } from '../../../work/workTask'
import type {
  WorkBegin,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/work/work.type'
import type { RequestReachabilityWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { ReachabilityStateInput } from '../contracts/generatedReachabilityEvaluation.type'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { ReachabilityEvaluation } from '../contracts/reachabilityEvaluation.type'
import type { StepValidityResult } from '../../validation/contracts/stepValidityResult.type'
import type RequestState from '../../../runtime/pipeline/RequestState'
import type { PhaseWorkOutput } from '../../../contracts/runtime/requestPipelineOutput.type'
import ForgeInternalError from '../../../errors/ForgeInternalError'

const REQUEST_REACHABILITY_KIND = 'request.reachability'

export const REQUEST_REACHABILITY_WORK_INSTRUMENTATION: WorkInstrumentation<
  RequestReachabilityWorkProps,
  PhaseWorkOutput
> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestState, RequestReachabilityWorkProps>) {
    return {
      currentStepId: ctx.state.dependencies.currentStepId,
      mode: ctx.props.mode,
      stepCount: ctx.props.routeTemplateCatalog.routeTemplatePathByStepId.size,
      hasParams: ctx.state.context.request.params !== undefined,
    }
  },

  resolveTraceMetadataAtFinish(ctx: WorkContextContract<RequestState, RequestReachabilityWorkProps>) {
    const evaluation = ctx.state.reachabilityEvaluation

    return {
      ...captureContextSnapshot(ctx.state.context),
      resumeOutcome: evaluation?.resumeOutcome,
      resumeActive: evaluation?.resumeActive,
      reachableSteps: evaluation?.steps.filter(step => step.isReachable).length,
      defaultEntryRouteTemplatePath: evaluation?.defaultEntryRouteTemplatePath,
      frontierRouteTemplatePath: evaluation?.frontierRouteTemplatePath,
      hasReachabilityProjection: ctx.state.context.evaluation.reachability !== undefined,
    }
  },
}

/**
 * The reachability phase, for both step and journey requests. It evaluates the
 * compiled reachability facts (the dynamic expressions) and, on step requests,
 * answer-cleardown's compiled field inventory, runs the compiled reachability
 * state function over them (graph walk, path/frontier/resume), stores the
 * evaluation and its projection on the shared context, then resolves the
 * redirect: step mode redirects when the requested step is unreachable or a
 * resume should jump to the frontier, else continues to the `answer-cleardown`
 * phase and on to render; journey mode always redirects to the journey's first
 * reachable step.
 */
export const REQUEST_REACHABILITY_WORK_HANDLER: WorkHandler<'request.reachability', RequestReachabilityWorkProps> = {
  kind: REQUEST_REACHABILITY_KIND,

  async begin(
    ctx: WorkContextContract<RequestState, RequestReachabilityWorkProps>,
  ): Promise<WorkBegin<'request.reachability'>> {
    const { compiledReachabilityFacts, compiledReachabilityState } = ctx.props

    const reachabilityContext = buildCompiledReachabilityContext(
      ctx.state.context,
      ctx.state.dependencies.functionRegistry,
    )
    const stepValidities = toReachabilityValidities(ctx.state.context.evaluation.reachabilityValidities)
    const params = ctx.state.context.request.params

    const facts = await compiledReachabilityFacts(reachabilityContext)

    // Field inventory belongs to step requests: journey requests have no step to
    // project onto, and without params the projection cannot resolve step paths.
    const fieldInventory =
      ctx.props.mode === 'journey' || params === undefined
        ? undefined
        : await ctx.props.compiledFieldInventory?.(reachabilityContext)

    const stateInput: ReachabilityStateInput =
      ctx.props.mode === 'journey'
        ? { facts, routeTemplateCatalog: ctx.props.routeTemplateCatalog, stepValidities }
        : {
            facts,
            currentStepId: ctx.state.dependencies.currentStepId,
            routeTemplateCatalog: ctx.props.routeTemplateCatalog,
            stepValidities,
            params,
            fieldInventory,
          }

    const result = compiledReachabilityState(stateInput)

    if (result.reachability !== undefined) {
      ctx.state.context.evaluation.reachability = result.reachability
    }

    ctx.state.recordReachabilityEvaluation(result.evaluation)

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

// The reachability validities phase already executed only the rules reachability
// cares about (default group, no `submissionOnly`), so a stored result is valid
// exactly when it recorded no failures.
function toReachabilityValidities(
  reachabilityValidities: ReadonlyMap<NodeId, StepValidityResult> | undefined,
): Map<NodeId, boolean> {
  const validityByStepId = new Map<NodeId, boolean>()

  reachabilityValidities?.forEach((result, stepId) => {
    validityByStepId.set(stepId, result.fieldFailures.length === 0 && result.domainFailures.length === 0)
  })

  return validityByStepId
}

export function createRequestReachabilityTask(props: RequestReachabilityWorkProps) {
  return createWorkTask(
    'reachability',
    REQUEST_REACHABILITY_WORK_HANDLER,
    props,
    REQUEST_REACHABILITY_WORK_INSTRUMENTATION,
  )
}
