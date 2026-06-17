import type { CompiledValidationFunction } from '../../../contracts/compiled/compiledFunctions.type'
import type { NodeId } from '../../../contracts/ast/engine.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import { buildCompiledBaseContext } from '../../context/compiledEvaluationContext'
import type { StepValidityResult } from '../../../contracts/runtime/stepValidityResult.type'

export async function evaluateValidation(
  compiledValidation: CompiledValidationFunction | undefined,
  path: string,
  stepId: NodeId,
  context: RuntimeEvaluationContext,
  functionRegistry: FunctionRegistry,
  isSubmission: boolean,
  groups: string[],
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

  return result
}
