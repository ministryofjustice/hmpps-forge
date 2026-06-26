import type { ReachabilityEvaluation } from '../../../contracts/navigation/reachabilityEvaluation.type'
import type { StepValidationFailure } from '../../../contracts/runtime/evaluationState.type'
import type { ValidationResult } from '../../../contracts/runtime/validationResult.type'
import { resolvePathParams } from '../../../../framework/path/routePath'
import type { RenderContext } from '../../../../framework/rendering/types'
import { buildCompiledResolveContext } from '../context/compiledEvaluationContext'
import { resolveBacklinkRouteTemplatePath } from '../phases/reachability/navigationRedirects'
import { hydrateRouteTree } from '../phases/resolve/hydrateRouteTree'
import { RESOLVE_BLOCKS_KIND } from '../phases/resolve/ResolveBlocksWorkHandler'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/runtime/work.type'
import { singleChildOutput } from '../work/workTask'
import { phaseInstrumentation, runTaskPhase } from './requestPhase'
import type { RequestResolveWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { PhaseWorkOutput, RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'

export const REQUEST_RESOLVE_KIND = 'request.resolve'

export const REQUEST_RESOLVE_WORK_INSTRUMENTATION: WorkInstrumentation<RequestResolveWorkProps, PhaseWorkOutput> =
  phaseInstrumentation()

/**
 * The resolve phase as work. `begin` runs the compiled block task; `complete`
 * assembles the `RenderContext` from the resolved blocks plus the
 * navigation/validation signalling on the context. When a renderer is present,
 * it stores the context for the render phase and continues. Otherwise it
 * returns the render context as the terminal outcome.
 */
export const REQUEST_RESOLVE_WORK_HANDLER: WorkHandler<'request.resolve', RequestResolveWorkProps> = {
  kind: REQUEST_RESOLVE_KIND,

  async begin(ctx: WorkContextContract<RequestExecutionContext, RequestResolveWorkProps>) {
    if (!ctx.props.compiled) {
      throw new Error(
        `[Forge] Resolve compilation is required — compiledResolve function is missing for step "${ctx.props.path}"`,
      )
    }

    const fieldFailures: Record<string, ValidationResult[]> = ctx.request.showValidationFailures
      ? groupFieldFailuresByBlockId(ctx.request.validation?.fieldFailures ?? [])
      : {}

    const compiledResolveContext = buildCompiledResolveContext(
      ctx.request.context,
      ctx.request.functionRegistry,
      fieldFailures,
    )

    return runTaskPhase(
      ctx.props.compiled(compiledResolveContext),
      RESOLVE_BLOCKS_KIND,
      'Compiled render function returned an invalid resolve work task',
    )
  },

  complete(
    ctx: WorkContextContract<RequestExecutionContext, RequestResolveWorkProps>,
    children: readonly CompletedWork[],
  ): PhaseWorkOutput {
    const output = singleChildOutput(children, RESOLVE_BLOCKS_KIND)

    if (output === undefined) {
      throw new Error('Resolve work task completed with an invalid render result')
    }

    const step = resolveStepMetadata(
      output.step as RenderContext['step'],
      ctx.request.context.request.params,
      ctx.request.reachabilityEvaluation,
    )

    const showValidationFailures = ctx.request.showValidationFailures ?? false
    const fieldFailures = showValidationFailures ? (ctx.request.validation?.fieldFailures ?? []) : []
    const domainFailures = showValidationFailures ? (ctx.request.validation?.domainFailures ?? []) : []

    const renderContext: RenderContext = {
      routeTree: hydrateRouteTree(
        ctx.props.routeTree,
        ctx.props.currentRouteTemplatePath,
        ctx.request.context.request.params,
      ),
      step,
      ancestors: output.ancestors as RenderContext['ancestors'],
      blocks: [...output.blocks],
      showValidationFailures,
      fieldValidationErrors: fieldFailures.map(stripBlockId),
      domainValidationErrors: domainFailures,
      answers: ctx.request.context.domain.answers,
      data: ctx.request.context.domain.data,
    }

    if (ctx.request.hasRenderer) {
      ctx.request.renderContext = renderContext

      return { action: 'continue' }
    }

    return { action: 'render', renderContext }
  },
}

function resolveStepMetadata(
  step: RenderContext['step'],
  params: Record<string, string>,
  reachabilityEvaluation: ReachabilityEvaluation | undefined,
): RenderContext['step'] {
  if (step.backlink !== undefined || !reachabilityEvaluation) {
    return step
  }

  const backPath = resolveBacklinkRouteTemplatePath(reachabilityEvaluation)

  if (!backPath) {
    return step
  }

  return {
    ...step,
    backlink: resolvePathParams(backPath, params),
  }
}

// Groups the step's field failures by render block ID (stripping blockId), so
// each field self-resolves its own failures during render. Field code is answer
// identity, not render-block identity.
function groupFieldFailuresByBlockId(failures: readonly StepValidationFailure[]): Record<string, ValidationResult[]> {
  const grouped: Record<string, ValidationResult[]> = {}

  failures.forEach(failure => {
    grouped[failure.blockId] ??= []
    grouped[failure.blockId].push(stripBlockId(failure))
  })

  return grouped
}

function stripBlockId(failure: StepValidationFailure): ValidationResult {
  const { blockId: _, ...validation } = failure

  return validation
}
