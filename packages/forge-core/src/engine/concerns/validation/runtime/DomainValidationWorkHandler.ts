import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../../chassis/contracts/work/work.type'
import type { DomainValidationFailure } from '../../../chassis/contracts/runtime/evaluationState.type'
import { createWorkTask } from '../../../chassis/work/workTask'
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

  async begin(ctx: WorkContextContract<RequestState, DomainValidationWorkProps>) {
    return { output: await ctx.props.run() }
  },
}

export function createDomainValidationTask(key: string, props: DomainValidationWorkProps) {
  return createWorkTask(key, DOMAIN_VALIDATION_WORK_HANDLER, props, DOMAIN_VALIDATION_WORK_INSTRUMENTATION)
}
