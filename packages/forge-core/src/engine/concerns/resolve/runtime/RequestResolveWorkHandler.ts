import type { ReachabilityEvaluation } from '../../reachability/contracts/reachabilityEvaluation.type'
import type { StepValidationFailure } from '../../../contracts/runtime/evaluationState.type'
import type { ValidationResult } from '../../validation/contracts/validationResult.type'
import { resolvePathParams } from '../../../../shared/utils/routePath'
import type { RenderContext, RenderValidationError } from '../../../../framework/types/rendering.type'
import type { ViewConfig } from '../../../../authoring/types/structures.type'
import { buildCompiledResolveContext } from '../../../runtime/context/compiledEvaluationContext'
import { resolveBacklinkRouteTemplatePath } from '../../reachability/runtime/reachabilityRedirects'
import { RESOLVE_BLOCKS_KIND } from './ResolveBlocksWorkHandler'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/work/work.type'
import { createWorkTask, isWorkTaskOfKind, singleChildOutput, singleTaskGroup } from '../../../work/workTask'
import { phaseInstrumentation } from '../../../runtime/pipeline/contextSnapshot'
import type { RequestResolveWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type RequestState from '../../../runtime/pipeline/RequestState'
import type { PhaseWorkOutput } from '../../../contracts/runtime/requestPipelineOutput.type'
import ForgeInternalError from '../../../errors/ForgeInternalError'

const REQUEST_RESOLVE_KIND = 'request.resolve'

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

  async begin(ctx: WorkContextContract<RequestState, RequestResolveWorkProps>) {
    const fieldFailures: Record<string, ValidationResult[]> = groupFieldFailuresByBlockId(
      ctx.state.currentPageValidation?.fieldFailures ?? [],
    )
    const compiledResolveContext = buildCompiledResolveContext(
      ctx.state.context,
      ctx.state.dependencies.functionRegistry,
      ctx.state.dependencies.componentRegistry,
      fieldFailures,
      ctx.state.fieldFailureAnchors,
    )

    const resolved = await ctx.props.compiled(compiledResolveContext)

    if (!isWorkTaskOfKind(resolved, RESOLVE_BLOCKS_KIND)) {
      throw new ForgeInternalError('Compiled render function returned an invalid resolve work task')
    }

    return singleTaskGroup(resolved)
  },

  complete(
    ctx: WorkContextContract<RequestState, RequestResolveWorkProps>,
    children: readonly CompletedWork[],
  ): PhaseWorkOutput {
    const output = singleChildOutput(children, RESOLVE_BLOCKS_KIND)

    if (output === undefined) {
      throw new ForgeInternalError('Resolve work task completed with an invalid render result')
    }

    const ancestors = output.ancestors as RenderContext['ancestors']
    const stepMetadata = resolveStepMetadata(
      output.step as RenderContext['step'],
      ctx.state.context.request.params,
      ctx.state.reachabilityEvaluation,
    )
    const view = resolveView(ancestors, stepMetadata.view)
    const step = view === undefined ? stepMetadata : { ...stepMetadata, view }

    // The presence of a current-page result is the display signal: present means
    // validation ran (possibly passing with no failures), absent means it never ran.
    const validation = ctx.state.currentPageValidation

    const showValidationFailures = validation !== undefined
    const fieldFailures = validation?.fieldFailures ?? []
    const domainFailures = validation?.domainFailures ?? []

    const renderContext: RenderContext = {
      routeTree: ctx.state.routeTree ?? [],
      step,
      ancestors,
      blocks: [...output.blocks],
      showValidationFailures,
      fieldValidationErrors: fieldFailures.map(failure =>
        toRenderValidationError(failure, ctx.state.fieldFailureAnchors),
      ),
      domainValidationErrors: domainFailures,
      answers: ctx.state.context.domain.answers,
      data: ctx.state.context.domain.data,
    }

    if (ctx.state.dependencies.hasRenderer) {
      ctx.state.recordRenderContext(renderContext)

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

// Pairs a failure with its failing block instance's document anchor, recorded
// during block resolution, so the error summary links to the right instance
// even when several blocks share one code.
function toRenderValidationError(
  failure: StepValidationFailure,
  fieldFailureAnchors: Record<string, string>,
): RenderValidationError {
  const anchor = fieldFailureAnchors[failure.blockId]

  return anchor === undefined ? stripBlockId(failure) : { ...stripBlockId(failure), anchor }
}

export function createRequestResolveTask(props: RequestResolveWorkProps) {
  return createWorkTask('resolve', REQUEST_RESOLVE_WORK_HANDLER, props, REQUEST_RESOLVE_WORK_INSTRUMENTATION)
}
