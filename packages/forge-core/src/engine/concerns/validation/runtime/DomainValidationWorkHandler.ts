import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../contracts/runtime/work.type'
import type { DomainValidationFailure } from '../../../contracts/runtime/evaluationState.type'
import type { DomainValidationWorkProps } from '../contracts/ValidationWork.type'

export const DOMAIN_VALIDATION_KIND = 'validation.domain'

export const DOMAIN_VALIDATION_WORK_INSTRUMENTATION: WorkInstrumentation<
  DomainValidationWorkProps,
  readonly DomainValidationFailure[]
> = {
  resolveTraceMetadataAtStart() {
    return undefined
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return { failures: output.length }
  },
}

export const DOMAIN_VALIDATION_WORK_HANDLER: WorkHandler<'validation.domain', DomainValidationWorkProps> = {
  kind: DOMAIN_VALIDATION_KIND,

  async begin(ctx: WorkContextContract<RequestExecutionContext, DomainValidationWorkProps>) {
    return { output: await ctx.props.run() }
  },
}
