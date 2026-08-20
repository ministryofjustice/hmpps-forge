import type { NodeId } from '../../../chassis/contracts/ast/ast.type'
import type { StepValidityResult } from '../contracts/stepValidityResult.type'
import type { RuntimeContext } from '../../../chassis/contracts/runtime/evaluationState.type'

/**
 * Records a non-current step's reachability-round failure set into the per-step
 * `reachabilityValidities` map on the request context. Only the reachability
 * validities phase writes here; the current-page round stores its result on
 * `RequestState.currentPageValidation` instead.
 */
export function recordReachabilityValidity(context: RuntimeContext, stepId: NodeId, result: StepValidityResult): void {
  if (context.evaluation.reachabilityValidities === undefined) {
    context.evaluation.reachabilityValidities = new Map()
  }

  context.evaluation.reachabilityValidities.set(stepId, result)
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
