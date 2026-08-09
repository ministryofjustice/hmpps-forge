import type { StepValidityResult } from '../contracts/stepValidityResult.type'
import type { DomainValidationFailure, StepValidationFailure } from '../../../contracts/runtime/evaluationState.type'
import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import type {
  CompletedWork,
  WorkContextContract,
  WorkHandler,
  WorkInstrumentation,
} from '../../../contracts/runtime/work.type'
import type { TraceSpanFields } from '../../../diagnostics/tracing/traceSpan.type'
import { childOutputs } from '../../../runtime/evaluation/work/workTask'
import { FIELD_VALIDATION_KIND } from './FieldValidationWorkHandler'
import { DOMAIN_VALIDATION_KIND } from './DomainValidationWorkHandler'
import type { StepValidationWorkProps } from '../contracts/ValidationWork.type'

export const STEP_VALIDATION_KIND = 'validation.step'

export const STEP_VALIDATION_WORK_INSTRUMENTATION: WorkInstrumentation<StepValidationWorkProps, StepValidityResult> = {
  resolveTraceMetadataAtStart(ctx: WorkContextContract<RequestExecutionContext, StepValidationWorkProps>) {
    return traceBegin(ctx.props)
  },

  resolveTraceMetadataAtFinish(_ctx, output) {
    return traceComplete(output)
  },
}

export const STEP_VALIDATION_WORK_HANDLER: WorkHandler<'validation.step', StepValidationWorkProps> = {
  kind: STEP_VALIDATION_KIND,

  begin(ctx: WorkContextContract<RequestExecutionContext, StepValidationWorkProps>) {
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
    _ctx: WorkContextContract<RequestExecutionContext, StepValidationWorkProps>,
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
