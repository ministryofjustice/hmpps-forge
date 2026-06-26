import type { RequestExecutionContext } from '../../../../contracts/runtime/RequestExecutionContext.type'
import type { ReachabilityEvaluationResult } from '../../../../contracts/navigation/generatedReachabilityEvaluation.type'
import { finalizeReachabilityEvaluation } from './evaluateGeneratedNavigation'
import ReachabilityGraphBuilder from './ReachabilityGraphBuilder'
import type {
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
  WorkUnitFields,
} from '../../../../contracts/runtime/work.type'
import type { ReachabilityEvaluationWorkProps } from '../../../../contracts/runtime/ReachabilityEvaluationWork.type'

export const REACHABILITY_EVALUATION_KIND = 'reachability.evaluation'

/**
 * Computes the navigation evaluation. `begin` produces no child
 * work; `complete` reads the precomputed per-step validities from the input, builds
 * the reachability graph, and finalizes the result. The validities are filled
 * up front by the eager `validities` phase, so the walk never has to evaluate
 * validation itself.
 */
export const REACHABILITY_EVALUATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  ReachabilityEvaluationWorkProps,
  ReachabilityEvaluationResult
> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestExecutionContext, ReachabilityEvaluationWorkProps>) {
    return traceBegin(ctx.props)
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return traceComplete(output)
  },
}

export const REACHABILITY_EVALUATION_WORK_HANDLER: WorkHandler<
  'reachability.evaluation',
  ReachabilityEvaluationWorkProps
> = {
  kind: REACHABILITY_EVALUATION_KIND,

  begin() {
    return { groups: [] }
  },

  complete(
    ctx: WorkContextContract<RequestExecutionContext, ReachabilityEvaluationWorkProps>,
  ): ReachabilityEvaluationResult {
    const builder = new ReachabilityGraphBuilder()
    const steps = builder.buildReachableSteps(
      ctx.props.input.plan,
      ctx.props.input.currentStepId,
      ctx.props.input.routeTemplateCatalog,
      ctx.props.compiledResult,
      ctx.props.input.stepValidities ?? new Map(),
    )
    const defaultEntryRouteTemplatePath = builder.resolveDefaultEntryRouteTemplatePath()

    return finalizeReachabilityEvaluation(
      steps,
      defaultEntryRouteTemplatePath,
      ctx.props.input,
      ctx.props.compiledResult,
    )
  },
}

function traceBegin(props: ReachabilityEvaluationWorkProps): WorkUnitFields {
  return {
    currentStepId: props.input.currentStepId,
    stepCount: props.input.plan.entries.length,
    hasParams: props.input.params !== undefined,
    hasFieldInventory: props.input.fieldInventory !== undefined,
  }
}

function traceComplete(output: ReachabilityEvaluationResult): WorkUnitFields {
  return {
    resumeOutcome: output.evaluation.resumeOutcome,
    resumeActive: output.evaluation.resumeActive,
    reachableSteps: output.evaluation.steps.filter(step => step.isReachable).length,
    defaultEntryRouteTemplatePath: output.evaluation.defaultEntryRouteTemplatePath,
    frontierRouteTemplatePath: output.evaluation.frontierRouteTemplatePath,
    hasReachabilityProjection: output.reachability !== undefined,
  }
}
