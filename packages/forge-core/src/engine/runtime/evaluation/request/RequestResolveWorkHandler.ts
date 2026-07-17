import type { ReachabilityEvaluation } from '../../../contracts/reachability/reachabilityEvaluation.type'
import type { StepValidationFailure } from '../../../contracts/runtime/evaluationState.type'
import type { ValidationResult } from '../../../contracts/runtime/validationResult.type'
import { resolvePathParams } from '../../../../framework/path/routePath'
import type { RenderContext } from '../../../../framework/rendering/types'
import type { ViewConfig } from '../../../../authoring/types/structures.type'
import { buildCompiledResolveContext } from '../context/compiledEvaluationContext'
import { resolveBacklinkRouteTemplatePath } from '../phases/reachability/reachabilityRedirects'
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
 * assembles the `RenderContext` from the resolved blocks, effective inherited
 * view, and navigation/validation signalling on the context. When a renderer is present,
 * it stores the context for the render phase and continues. Otherwise it
 * returns the render context as the terminal outcome.
 */
export const REQUEST_RESOLVE_WORK_HANDLER: WorkHandler<'request.resolve', RequestResolveWorkProps> = {
  kind: REQUEST_RESOLVE_KIND,

  async begin(ctx: WorkContextContract<RequestExecutionContext, RequestResolveWorkProps>) {
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

    const ancestors = output.ancestors as RenderContext['ancestors']
    const stepMetadata = resolveStepMetadata(
      output.step as RenderContext['step'],
      ctx.request.context.request.params,
      ctx.request.reachabilityEvaluation,
    )
    const view = resolveView(ancestors, stepMetadata.view)
    const step = view === undefined ? stepMetadata : { ...stepMetadata, view }

    const showValidationFailures = ctx.request.showValidationFailures ?? false
    const fieldFailures = showValidationFailures ? (ctx.request.validation?.fieldFailures ?? []) : []
    const domainFailures = showValidationFailures ? (ctx.request.validation?.domainFailures ?? []) : []

    const renderContext: RenderContext = {
      routeTree: ctx.request.routeTree ?? [],
      step,
      ancestors,
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

function resolveView(ancestors: RenderContext['ancestors'], stepView: ViewConfig | undefined): ViewConfig | undefined {
  const viewConfigs = [
    ...ancestors.flatMap(ancestor => (ancestor.view === undefined ? [] : [ancestor.view])),
    ...(stepView === undefined ? [] : [stepView]),
  ]

  if (viewConfigs.length === 0) {
    return undefined
  }

  const template = viewConfigs.reduce<string | undefined>(
    (resolvedTemplate, view) => view.template ?? resolvedTemplate,
    undefined,
  )
  const locals = viewConfigs.reduce<Record<string, unknown>>(
    (resolvedLocals, view) => ({ ...resolvedLocals, ...view.locals }),
    {},
  )
  const hasLocals = viewConfigs.some(view => view.locals !== undefined)

  return {
    ...(template === undefined ? {} : { template }),
    ...(hasLocals ? { locals } : {}),
  }
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
