import type { NodeId } from '../../../contracts/ast/ast.type'
import type { StepValidityResult } from '../contracts/stepValidityResult.type'
import type { RuntimeContext } from '../../../contracts/runtime/evaluationState.type'

/**
 * Records a step's full failure set into the per-step `stepValidities` map on the
 * request context. The eager validities phase records every step with validation up
 * front; submit overwrites the current step's entry with its submission-mode set.
 */
export function recordStepValidationState(context: RuntimeContext, stepId: NodeId, result: StepValidityResult): void {
  if (context.evaluation.stepValidities === undefined) {
    context.evaluation.stepValidities = new Map()
  }

  context.evaluation.stepValidities.set(stepId, result)
}

/**
 * Reads a step's stored full failure set from request state, or undefined when the
 * step has no recorded validation.
 */
export function getStepValidity(context: RuntimeContext, stepId: NodeId | undefined): StepValidityResult | undefined {
  return stepId === undefined ? undefined : context.evaluation.stepValidities?.get(stepId)
}

export function isStepValidityResult(value: unknown): value is StepValidityResult {
  if (value === undefined || value === null || typeof value !== 'object') {
    return false
  }

  if (!('fieldFailures' in value) || !('domainFailures' in value)) {
    return false
  }

  return Array.isArray(value.fieldFailures) && Array.isArray(value.domainFailures)
}
