import type { CompiledValidationFunction } from '../../../chassis/contracts/compiled/compiledFunctions.type'
import type { NodeId } from '../../../chassis/contracts/ast/ast.type'
import type FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import type { RuntimeContext } from '../../../chassis/contracts/runtime/evaluationState.type'
import { buildCompiledValidationContext } from '../../../chassis/runtime/context/compiledEvaluationContext'
import { createWorkTask, isWorkTask } from '../../../chassis/work/workTask'
import type { StepValidationWorkTask, ValidationRuleFilter } from '../contracts/ValidationWork.type'
import { STEP_VALIDATION_WORK_HANDLER } from './StepValidationWorkHandler'

/**
 * The work task key a step's validation task is built under. The step id
 * is encoded into the key so the reachability validities phase can map each
 * completed child back to its step in `complete` without a per-unit side-channel.
 */
export function validationTaskKey(stepId: NodeId): string {
  return `validation:${stepId}`
}

/**
 * Builds (without executing) a step's validation task, re-keyed to the
 * step so callers can tell sibling step validations apart. Callers run it
 * through the main executor — the reachability validities phase as concurrent
 * children, current-step validation as a single discovered child — so there is
 * no nested executor. The filter selects which rules the run executes; the
 * compiled function applies it before evaluating any rule condition. Returns
 * undefined when the step has no compiled validation.
 */
export async function buildStepValidationTask(
  compiledValidation: CompiledValidationFunction | undefined,
  stepId: NodeId,
  context: RuntimeContext,
  functionRegistry: FunctionRegistry,
  filter: ValidationRuleFilter,
): Promise<StepValidationWorkTask | undefined> {
  if (!compiledValidation) {
    return undefined
  }

  const validationContext = buildCompiledValidationContext(context, functionRegistry)
  const task = await compiledValidation(validationContext, filter)

  if (!isStepValidationWorkTask(task)) {
    return undefined
  }

  return createWorkTask(validationTaskKey(stepId), task.handler, task.props, task.instrumentation)
}

function isStepValidationWorkTask(value: unknown): value is StepValidationWorkTask {
  return isWorkTask(value) && value.handler === STEP_VALIDATION_WORK_HANDLER
}
