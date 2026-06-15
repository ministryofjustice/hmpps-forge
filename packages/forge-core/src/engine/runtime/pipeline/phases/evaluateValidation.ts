import type { StepValidationFailure } from '../../../contracts/runtime/evaluationState.type'
import type { CompiledFieldValidation, ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { MaterialisedTemplateNode } from '../../../contracts/plans/materialisationArtefacts.type'
import type { ValidationContext } from '../../../contracts/compiled/phaseContexts.type'
import type { StepValidityResult, ValidationEvaluationInput } from '../../../contracts/runtime/stepValidityResult.type'
import type TraceRecorder from '../trace/TraceRecorder'
import { measureAsyncFrom } from '../trace/TraceRecorder'

/**
 * The engine's only sub-walk: a walk with no phase of its own, run by three
 * hosts — the entry-validation phase, submit hooks on demand via the
 * `ctx.validate(groups)` callback, and the reachability walk's re-check of
 * each visited step's validity.
 *
 * Runs a step's ValidationPlan: validates every plain field and every
 * materialised template node, then runs the optional domain validator. The plain
 * fields all validate concurrently, as do the materialised nodes, but the three
 * stages (fields, materialised, domain) await in sequence. Returns the combined
 * verdict; the host that invoked the walk owns recording it on state. When a
 * trace recorder is supplied, records one decision per field and domain check,
 * passes included — the units land in whichever phase the host has open.
 * `input.groups` gates which validation groups apply; `input.isSubmission`
 * distinguishes a POST submit from a GET entry check.
 */
export async function evaluateValidation(
  validationPlan: ValidationPlan,
  ctx: ValidationContext,
  input: ValidationEvaluationInput,
  trace?: TraceRecorder,
  materialisedNodes?: MaterialisedTemplateNode[],
): Promise<StepValidityResult> {
  const { isSubmission, groups } = input

  const fieldResults = await Promise.all(
    validationPlan.fieldValidations.map(entry => validateField(entry, ctx, isSubmission, groups, trace)),
  )

  const materialisedResults = await evaluateMaterialisedValidations(
    materialisedNodes ?? [],
    ctx,
    isSubmission,
    groups,
    trace,
  )

  const fieldFailures = [...fieldResults.flat(), ...materialisedResults]

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
  return measureAsyncFrom(
    trace,
    f => ({ kind: 'field-validation', nodeId: entry.nodeId, isValid: f.length === 0, failures: f }),
    () => entry.validate(ctx, isSubmission, groups),
  )
}

/**
 * Validates materialised template nodes by calling each node's scope-bound
 * validate closure directly. All nodes validate concurrently. Nodes without
 * a validate function are skipped (they belong to non-validation phases).
 */
async function evaluateMaterialisedValidations(
  nodes: MaterialisedTemplateNode[],
  ctx: ValidationContext,
  isSubmission: boolean,
  groups: string[],
  trace: TraceRecorder | undefined,
): Promise<StepValidationFailure[]> {
  const validationCalls = nodes
    .map(node => {
      if (node.validate === undefined) {
        return undefined
      }

      return measureAsyncFrom(
        trace,
        f => ({
          kind: 'field-validation',
          nodeId: node.sourceNodeId,
          itemIndex: node.origin.itemIndex,
          isValid: f.length === 0,
          failures: f,
        }),
        () => node.validate!(ctx, isSubmission, groups),
      )
    })
    .filter((call): call is Promise<StepValidationFailure[]> => call !== undefined)

  const results = await Promise.all(validationCalls)

  return results.flat()
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
  const domain = validationPlan.domain

  if (!domain) {
    return []
  }

  return measureAsyncFrom(
    trace,
    f => ({ kind: 'domain-validation', isValid: f.length === 0, failures: f }),
    () => domain(ctx, isSubmission, groups),
  )
}
