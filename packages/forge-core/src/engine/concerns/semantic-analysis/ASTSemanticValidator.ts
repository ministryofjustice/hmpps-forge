import type { ASTValidationContext, ASTValidationRule } from './rules/types'
import { validateReferenceScopes } from './rules/validateReferenceScopes'
import { validateEffectScope } from './rules/validateEffectScope'
import { validateRegisteredFunctions } from './rules/validateRegisteredFunctions'
import { validateFunctionArity } from './rules/validateFunctionArity'
import { validateRegisteredComponents } from './rules/validateRegisteredComponents'
import { validateValidationScope } from './rules/validateValidationScope'
import { validateOutcomeScope } from './rules/validateOutcomeScope'
import { validateHookScope } from './rules/validateHookScope'
import { validateTieBreakerScope } from './rules/validateTieBreakerScope'
import { validateStructureScope } from './rules/validateStructureScope'
import { validateBlockScope } from './rules/validateBlockScope'
import { validateFieldCodeUniqueness } from './rules/validateFieldCodeUniqueness'
import { validateFunctionArguments } from './rules/validateFunctionArguments'
import { validateContainerTypes } from './rules/validateContainerTypes'

const RULES: readonly ASTValidationRule[] = [
  validateReferenceScopes,
  validateEffectScope,
  validateRegisteredFunctions,
  validateFunctionArity,
  validateRegisteredComponents,
  validateValidationScope,
  validateOutcomeScope,
  validateHookScope,
  validateTieBreakerScope,
  validateStructureScope,
  validateBlockScope,
  validateFieldCodeUniqueness,
  validateFunctionArguments,
  validateContainerTypes,
]

export default class ASTSemanticValidator {
  constructor(private readonly context: ASTValidationContext) {}

  validate(): void {
    const errors: Error[] = []

    RULES.forEach(rule => {
      errors.push(...rule(this.context))
    })

    if (errors.length > 0) {
      throw new AggregateError(errors, 'AST semantic validation failed')
    }
  }
}
