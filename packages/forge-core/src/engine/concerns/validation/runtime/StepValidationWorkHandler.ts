import type { StepValidityResult } from '../contracts/stepValidityResult.type'
import type {
  DomainValidationFailure,
  StepValidationFailure,
} from '../../../chassis/contracts/runtime/evaluationState.type'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../chassis/contracts/work/work.type'
import type { TraceSpanFields } from '../../../chassis/tracing/traceSpan.type'
import { childOutputs, createWorkTask } from '../../../chassis/work/workTask'
import { FIELD_VALIDATION_KIND } from './FieldValidationWorkHandler'
import { DOMAIN_VALIDATION_KIND } from './DomainValidationWorkHandler'
import type {
  DomainValidationWorkTask,
  FieldValidationWorkTask,
  StepValidationWorkProps,
} from '../contracts/ValidationWork.type'

export const STEP_VALIDATION_KIND = 'validation.step'

export const STEP_VALIDATION_WORK_INSTRUMENTATION: WorkInstrumentation<StepValidationWorkProps, StepValidityResult> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestState, StepValidationWorkProps>) {
    return traceBegin(ctx.props)
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return traceComplete(output)
  },
}

export const STEP_VALIDATION_WORK_HANDLER: WorkHandler<'validation.step', StepValidationWorkProps> = {
  kind: STEP_VALIDATION_KIND,

  begin(ctx: WorkContextContract<RequestState, StepValidationWorkProps>) {
    return {
      groups: [
        {
          mode: 'concurrent',
          children: ctx.props.fields,
        },
        {
          mode: 'concurrent',
          children: ctx.props.domains,
        },
      ],
    }
  },

  complete(
    _ctx: WorkContextContract<RequestState, StepValidationWorkProps>,
    children: readonly CompletedWork[],
  ): StepValidityResult {
    const fieldFailures = collectFieldFailures(children)
    const domainFailures = collectDomainFailures(children)

    return { fieldFailures, domainFailures }
  },
}

function collectFieldFailures(children: readonly CompletedWork[]): StepValidationFailure[] {
  return childOutputs(children, FIELD_VALIDATION_KIND).flatMap(failures => failures)
}

function collectDomainFailures(children: readonly CompletedWork[]): DomainValidationFailure[] {
  return childOutputs(children, DOMAIN_VALIDATION_KIND).flatMap(failures => failures)
}

function traceBegin(props: StepValidationWorkProps): TraceSpanFields {
  return {
    fieldValidations: props.fields.length,
    domainValidations: props.domains.length,
  }
}

function traceComplete(output: StepValidityResult): TraceSpanFields {
  return {
    fieldFailures: output.fieldFailures.length,
    domainFailures: output.domainFailures.length,
  }
}

export function createStepValidationTask(
  fields: readonly FieldValidationWorkTask[],
  domains: readonly DomainValidationWorkTask[],
) {
  return createWorkTask(
    'validation-step',
    STEP_VALIDATION_WORK_HANDLER,
    { fields, domains },
    STEP_VALIDATION_WORK_INSTRUMENTATION,
  )
}
