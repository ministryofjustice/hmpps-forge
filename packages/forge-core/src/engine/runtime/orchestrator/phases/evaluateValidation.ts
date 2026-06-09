import type { NodeId } from '../../../contracts/ast/engine.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type { StepValidationFailure } from '../../../contracts/runtime/evaluationState.type'
import type {
  FieldValidationEntry,
  IteratorFieldValidationEntry,
  IteratorValidationGroup,
  ValidationPlan,
} from '../../../contracts/plans/compilationArtefacts.type'
import type { ValidationContext } from '../../../contracts/compiled/phaseContexts.type'
import type { IteratorItemScope } from '../../../contracts/compiled/compiledFunctions.type'
import { buildCompiledBaseContext } from '../../context/compiledEvaluationContext'
import type { StepValidityResult } from '../../../contracts/runtime/stepValidityResult.type'
import type TraceRecorder from '../trace/TraceRecorder'

/**
 * Runs a step's ValidationPlan against the current request: validates every
 * plain field and every iterator-group field (per expanded item), then runs the
 * optional domain validator. The plain fields all validate concurrently, as do
 * the iterator groups, but the three stages (fields, iterators, domain) await in
 * sequence. Records the combined verdict on `context.global.validation` as a
 * side effect, and — when a trace recorder is supplied — one decision per field,
 * iterator expansion, and domain check, passes included. Throws when no plan is
 * supplied. `groups` gates which validation groups apply; `isSubmission`
 * distinguishes a POST submit from a GET entry check.
 */
export async function evaluateValidation(
  validationPlan: ValidationPlan | undefined,
  path: string,
  stepId: NodeId,
  context: RuntimeEvaluationContext,
  functionRegistry: FunctionRegistry,
  isSubmission: boolean,
  groups: string[],
  trace?: TraceRecorder,
): Promise<StepValidityResult> {
  if (!validationPlan) {
    throw new Error(`[Forge] Validation plan is missing for step "${path}"`)
  }

  const ctx = buildCompiledBaseContext(context, functionRegistry)

  const fieldResults = await Promise.all(
    validationPlan.fields.map(entry => validateField(entry, ctx, isSubmission, groups, trace)),
  )

  const iteratorResults = await evaluateIteratorGroups(validationPlan.iteratorGroups, ctx, isSubmission, groups, trace)

  const fieldFailures = [...fieldResults.flat(), ...iteratorResults]

  const domainFailures = await evaluateDomain(validationPlan, ctx, isSubmission, groups, trace)

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

  return result
}

/**
 * Validates one plain field, recording its verdict — pass or fail — against the
 * entry's identity.
 */
async function validateField(
  entry: FieldValidationEntry,
  ctx: ValidationContext,
  isSubmission: boolean,
  groups: string[],
  trace: TraceRecorder | undefined,
): Promise<StepValidationFailure[]> {
  const startedAt = performance.now()
  const failures = await entry.validate(ctx, isSubmission, groups)

  trace?.record({
    kind: 'field-validation',
    nodeId: entry.nodeId,
    isValid: failures.length === 0,
    failures,
    durationMs: performance.now() - startedAt,
  })

  return failures
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
  trace: TraceRecorder | undefined,
): Promise<StepValidationFailure[]> {
  if (iteratorGroups.length === 0) {
    return []
  }

  const groupResults = await Promise.all(
    iteratorGroups.map(group => evaluateSingleIteratorGroup(group, ctx, isSubmission, groups, trace)),
  )

  return groupResults.flat()
}

/**
 * Expands one MAP iterator's collection into per-item scopes, then validates
 * every field of the group once per item, all concurrently. Records the
 * expansion's item count and one verdict per field per item. Returns an empty
 * array when the collection is empty, so the group contributes no failures.
 */
async function evaluateSingleIteratorGroup(
  group: IteratorValidationGroup,
  ctx: ValidationContext,
  isSubmission: boolean,
  groups: string[],
  trace: TraceRecorder | undefined,
): Promise<StepValidationFailure[]> {
  const inputStartedAt = performance.now()
  const items = await group.evaluateInput(ctx)

  trace?.record({
    kind: 'iterator-input',
    nodeId: group.nodeId,
    itemCount: items.length,
    durationMs: performance.now() - inputStartedAt,
  })

  if (items.length === 0) {
    return []
  }

  const results = await Promise.all(
    items.flatMap(itemScope =>
      group.fields.map(field => validateIteratorField(field, ctx, isSubmission, groups, itemScope, trace)),
    ),
  )

  return results.flat()
}

/**
 * Validates one iterator field for one item scope, recording its verdict with
 * the item index so per-item decisions stay distinguishable.
 */
async function validateIteratorField(
  field: IteratorFieldValidationEntry,
  ctx: ValidationContext,
  isSubmission: boolean,
  groups: string[],
  itemScope: IteratorItemScope,
  trace: TraceRecorder | undefined,
): Promise<StepValidationFailure[]> {
  const startedAt = performance.now()
  const failures = await field.validate(ctx, isSubmission, groups, itemScope)

  trace?.record({
    kind: 'field-validation',
    nodeId: field.nodeId,
    itemIndex: itemScope.index,
    isValid: failures.length === 0,
    failures,
    durationMs: performance.now() - startedAt,
  })

  return failures
}

/**
 * Runs the optional domain validator and records its verdict. Returns no
 * failures (and records nothing) when the plan has no domain validation.
 */
async function evaluateDomain(
  validationPlan: ValidationPlan,
  ctx: ValidationContext,
  isSubmission: boolean,
  groups: string[],
  trace: TraceRecorder | undefined,
): Promise<StepValidityResult['domainFailures']> {
  if (!validationPlan.domain) {
    return []
  }

  const startedAt = performance.now()
  const failures = await validationPlan.domain(ctx, isSubmission, groups)

  trace?.record({
    kind: 'domain-validation',
    isValid: failures.length === 0,
    failures,
    durationMs: performance.now() - startedAt,
  })

  return failures
}
