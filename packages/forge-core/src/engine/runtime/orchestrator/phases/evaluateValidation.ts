import type { NodeId } from '../../../contracts/ast/engine.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type { DomainValidationFailure, StepValidationFailure } from '../../../contracts/runtime/evaluationState.type'
import type { ForgeInstrumentation } from '../../../../instrumentation/ForgeInstrumentation'
import type { ForgeSpanAttributes } from '../../../../instrumentation/types'
import type { IteratorValidationGroup, ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { ValidationContext } from '../../../contracts/compiled/phaseContexts.type'
import { buildCompiledBaseContext } from '../../context/compiledEvaluationContext'
import type { StepValidityResult } from '../../../contracts/runtime/stepValidityResult.type'

/**
 * Runs a step's ValidationPlan against the current request: validates every
 * plain field and every iterator-group field (per expanded item), then runs the
 * optional domain validator. The plain fields all validate concurrently, as do
 * the iterator groups, but the three stages (fields, iterators, domain) await in
 * sequence. Records the combined verdict on `context.global.validation` as a
 * side effect and emits a 'validation' span with one event per failure. Throws
 * when no plan is supplied. `groups` gates which validation groups apply;
 * `isSubmission` distinguishes a POST submit from a GET entry check.
 */
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

  const iteratorResults = await evaluateIteratorGroups(validationPlan.iteratorGroups, ctx, isSubmission, groups)

  const fieldFailures = [...fieldResults.flat(), ...iteratorResults]

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

/**
 * Validates every iterator group concurrently and flattens their failures into
 * one list. Returns an empty array when there are no groups.
 */
async function evaluateIteratorGroups(
  iteratorGroups: readonly IteratorValidationGroup[],
  ctx: ValidationContext,
  isSubmission: boolean,
  groups: string[],
): Promise<StepValidationFailure[]> {
  if (iteratorGroups.length === 0) {
    return []
  }

  const groupResults = await Promise.all(
    iteratorGroups.map(group => evaluateSingleIteratorGroup(group, ctx, isSubmission, groups)),
  )

  return groupResults.flat()
}

/**
 * Expands one MAP iterator's collection into per-item scopes, then validates
 * every field of the group once per item, all concurrently. Returns an empty
 * array when the collection is empty, so the group contributes no failures.
 */
async function evaluateSingleIteratorGroup(
  group: IteratorValidationGroup,
  ctx: ValidationContext,
  isSubmission: boolean,
  groups: string[],
): Promise<StepValidationFailure[]> {
  const items = await group.evaluateInput(ctx)

  if (items.length === 0) {
    return []
  }

  const results = await Promise.all(
    items.flatMap(itemScope => group.fields.map(field => field.validate(ctx, isSubmission, groups, itemScope))),
  )

  return results.flat()
}

/**
 * Builds the span-event attributes for a single validation failure. `blockId` is
 * included only for field failures (domain failures carry no block), and
 * `blockCode` only when the failure defines one.
 */
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
