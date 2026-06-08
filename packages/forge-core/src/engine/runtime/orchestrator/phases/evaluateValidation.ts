import type { NodeId } from '../../../contracts/ast/engine.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type { DomainValidationFailure, StepValidationFailure } from '../../../contracts/runtime/evaluationState.type'
import type { ForgeInstrumentation } from '../../../../instrumentation/ForgeInstrumentation'
import type { ForgeSpanAttributes } from '../../../../instrumentation/types'
import type { ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import { buildCompiledBaseContext } from '../../context/compiledEvaluationContext'
import type { StepValidityResult } from '../../../contracts/runtime/stepValidityResult.type'

export async function evaluateValidation(
  validationPlan: ValidationPlan | undefined,
  path: string,
  stepId: NodeId,
  context: RuntimeEvaluationContext,
  functionRegistry: FunctionRegistry,
  isSubmission: boolean,
  groups: string[],
  instrumentation: ForgeInstrumentation,
): Promise<StepValidityResult> {
  if (!validationPlan) {
    throw new Error(`[Forge] Validation plan is missing for step "${path}"`)
  }

  const ctx = buildCompiledBaseContext(context, functionRegistry)

  const fieldResults = await Promise.all(validationPlan.fields.map(entry => entry.validate(ctx, isSubmission, groups)))
  const fieldFailures = fieldResults.flat()

  const domainFailures = validationPlan.domain ? await validationPlan.domain(ctx, isSubmission, groups) : []

  const result: StepValidityResult = {
    isValid: fieldFailures.length === 0 && domainFailures.length === 0,
    fieldFailures,
    domainFailures,
  }

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
