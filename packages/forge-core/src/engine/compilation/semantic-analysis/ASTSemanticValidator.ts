import type ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import type ASTNodeTree from '../ast/ast-state/ASTNodeTree'
import type FunctionRegistry from '../../registries/FunctionRegistry'
import type ComponentRegistry from '../../registries/ComponentRegistry'
import type { ASTValidationContext, ASTValidationRule } from './rules/types'
import { validateReferenceScopes } from './rules/validateReferenceScopes'
import { validateEffectScope } from './rules/validateEffectScope'
import { validateRegisteredFunctions } from './rules/validateRegisteredFunctions'
import { validateRegisteredComponents } from './rules/validateRegisteredComponents'
import { validateValidationScope } from './rules/validateValidationScope'
import { validateOutcomeScope } from './rules/validateOutcomeScope'
import { validateHookScope } from './rules/validateHookScope'
import { validateTieBreakerScope } from './rules/validateTieBreakerScope'
import { validateFunctionArguments } from './rules/validateFunctionArguments'
import { validateContainerTypes } from './rules/validateContainerTypes'

const RULES: readonly ASTValidationRule[] = [
  validateReferenceScopes,
  validateEffectScope,
  validateRegisteredFunctions,
  validateRegisteredComponents,
  validateValidationScope,
  validateOutcomeScope,
  validateHookScope,
  validateTieBreakerScope,
  validateFunctionArguments,
  validateContainerTypes,
]

export default class ASTSemanticValidator {
  private readonly context: ASTValidationContext

  constructor(
    nodeIndex: ASTNodeIndex,
    nodeTree: ASTNodeTree,
    functionRegistry: FunctionRegistry,
    componentRegistry: ComponentRegistry,
  ) {
    this.context = { nodeIndex, nodeTree, functionRegistry, componentRegistry }
  }

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
