import ForgeInternalError from '../../../errors/ForgeInternalError'
import type { CompletedWork, WorkContextContract, WorkHandler } from '../../../contracts/runtime/work.type'
import type { RequestPipelineWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type {
  PhaseWorkOutput,
  RequestExecutionContext,
  RequestPipelineResult,
} from '../../../contracts/runtime/RequestExecutionContext.type'

export const REQUEST_PIPELINE_KIND = 'request.pipeline'

/**
 * The whole request as one work handler. `begin` runs the route's ordered phases as a
 * single sequential first-match group — the drain halts on the first phase that
 * redirects, errors, or renders. `complete` reads the phase outputs to produce the
 * resolved outcome: the halting phase's redirect/error, or the render context.
 */
export const REQUEST_PIPELINE_WORK_HANDLER: WorkHandler<'request.pipeline', RequestPipelineWorkProps> = {
  kind: REQUEST_PIPELINE_KIND,

  begin(ctx: WorkContextContract<RequestExecutionContext, RequestPipelineWorkProps>) {
    return {
      groups: [
        {
          mode: 'first-match',
          matches: child => isPhaseWorkOutput(child.output) && child.output.action !== 'continue',
          children: [...ctx.props.phases],
        },
      ],
    }
  },

  complete(
    ctx: WorkContextContract<RequestExecutionContext, RequestPipelineWorkProps>,
    children: readonly CompletedWork[],
  ): RequestPipelineResult {
    const result = resolveResult(children)

    ctx.request.pipelineResult = result

    return result
  },
}

function resolveResult(children: readonly CompletedWork[]): RequestPipelineResult {
  for (const child of children) {
    const output = child.output

    if (!isPhaseWorkOutput(output)) {
      continue
    }

    if (output.action === 'halt-redirect') {
      return { kind: 'redirect', target: output.target }
    }

    if (output.action === 'halt-error') {
      return { kind: 'error', status: output.status, message: output.message }
    }

    if (output.action === 'render') {
      return { kind: 'render', context: output.renderContext, output: output.output }
    }
  }

  throw new ForgeInternalError('Request pipeline produced no terminal outcome')
}

// The pipeline's children are heterogeneous phases that all produce PhaseWorkOutput,
// so the per-kind accessor doesn't apply; narrow the erased child output here.
function isPhaseWorkOutput(value: unknown): value is PhaseWorkOutput {
  return value !== null && typeof value === 'object' && 'action' in value
}
