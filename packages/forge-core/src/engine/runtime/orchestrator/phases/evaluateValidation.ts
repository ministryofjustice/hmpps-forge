import type { CompiledValidationFunction } from '../../../types/compiledPhaseResults.type'
import type { NodeId } from '../../../types/engine.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type { DomainValidationFailure, StepValidationFailure } from '../../context/RuntimeEvaluationContext'
import type { ForgeInstrumentation } from '../../../../instrumentation/ForgeInstrumentation'
import type { ForgeSpanAttributes } from '../../../../instrumentation/types'
import { buildCompiledBaseContext } from '../../context/compiledEvaluationContext'
import type { StepValidityResult } from '../../types/StepValidityResult.type'

export async function evaluateValidation(
  compiledValidation: CompiledValidationFunction | undefined,
  path: string,
  stepId: NodeId,
  context: RuntimeEvaluationContext,
  functionRegistry: FunctionRegistry,
  isSubmission: boolean,
  groups: string[],
  instrumentation: ForgeInstrumentation,
): Promise<StepValidityResult> {
  if (!compiledValidation) {
    throw new Error(`[Forge] Validation fallback is disabled — compiledValidation is missing for step "${path}"`)
  }

  const result = await compiledValidation(buildCompiledBaseContext(context, functionRegistry), isSubmission, groups)

  context.global.validation = {
    stepId,
    validated: true,
    groups,
    isSubmission,
    isValid: result.isValid,
    fieldFailures: result.fieldFailures,
    domainFailures: result.domainFailures,
  }

  instrumentation.span('validation', span => {
    span.setAttributes({
      'forge.validation.stepId': stepId,
      'forge.validation.isSubmission': isSubmission,
      'forge.validation.isValid': result.isValid,
      'forge.validation.fieldFailureCount': result.fieldFailures.length,
      'forge.validation.domainFailureCount': result.domainFailures.length,
    })

    result.fieldFailures.forEach(failure => {
      span.addEvent(
        'forge.validation.failure',
        validationFailureEventAttributes(stepId, 'field', isSubmission, failure),
      )
    })
    result.domainFailures.forEach(failure => {
      span.addEvent(
        'forge.validation.failure',
        validationFailureEventAttributes(stepId, 'domain', isSubmission, failure),
      )
    })
  })

  return result
}

function validationFailureEventAttributes(
  stepId: NodeId,
  scope: 'field' | 'domain',
  isSubmission: boolean,
  failure: StepValidationFailure | DomainValidationFailure,
): ForgeSpanAttributes {
  return {
    'forge.validation.failure.stepId': stepId,
    'forge.validation.failure.scope': scope,
    'forge.validation.failure.isSubmission': isSubmission,
    'forge.validation.failure.message': failure.message,
    'forge.validation.failure.submissionOnly': failure.submissionOnly,
    ...('blockId' in failure && { 'forge.validation.failure.blockId': failure.blockId }),
    ...(failure.blockCode !== undefined && { 'forge.validation.failure.blockCode': failure.blockCode }),
  }
}
