import type { StepValidationFailure } from '../../../contracts/runtime/evaluationState.type'
import type {
  CompiledFieldValidation,
  CompiledIteratorFieldValidation,
  IteratorValidationGroup,
  ValidationPlan,
} from '../../../contracts/plans/compilationArtefacts.type'
import type { ValidationContext } from '../../../contracts/compiled/phaseContexts.type'
import type { IteratorItemScope } from '../../../contracts/compiled/compiledFunctions.type'
import type { StepValidityResult, ValidationEvaluationInput } from '../../../contracts/runtime/stepValidityResult.type'
import type TraceRecorder from '../trace/TraceRecorder'

/**
 * The engine's only sub-walk: a walk with no phase of its own, run by three
 * hosts — the entry-validation phase, submit hooks on demand via the
 * `ctx.validate(groups)` callback, and the reachability walk's re-check of
 * each visited step's validity.
 *
 * Runs a step's ValidationPlan: validates every plain field and every
 * iterator-group field (per expanded item), then runs the optional domain
 * validator. The plain fields all validate concurrently, as do the iterator
 * groups, but the three stages (fields, iterators, domain) await in sequence.
 * Returns the combined verdict; the host that invoked the walk owns recording
 * it on state. When a trace recorder is supplied, records one decision per
 * field, iterator expansion, and domain check, passes included — the units land
 * in whichever phase the host has open. `input.groups` gates which validation
 * groups apply; `input.isSubmission` distinguishes a POST submit from a GET
 * entry check.
 */
export async function evaluateValidation(
  validationPlan: ValidationPlan,
  ctx: ValidationContext,
  input: ValidationEvaluationInput,
  trace?: TraceRecorder,
): Promise<StepValidityResult> {
  const { isSubmission, groups } = input

  const fieldResults = await Promise.all(
    validationPlan.fieldValidations.map(entry => validateField(entry, ctx, isSubmission, groups, trace)),
  )

  const iteratorResults = await evaluateIteratorGroups(
    validationPlan.iteratorValidationGroups,
    ctx,
    isSubmission,
    groups,
    trace,
  )

  const fieldFailures = [...fieldResults.flat(), ...iteratorResults]

  const domainFailures = await evaluateDomain(validationPlan, ctx, isSubmission, groups, trace)

  return {
    isValid: fieldFailures.length === 0 && domainFailures.length === 0,
    fieldFailures,
    domainFailures,
  }
}

/**
 * Validates one plain field, recording its verdict — pass or fail — against the
 * entry's identity.
 */
async function validateField(
  entry: CompiledFieldValidation,
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
  field: CompiledIteratorFieldValidation,
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
