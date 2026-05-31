import type ASTNodeIndex from '../ast-state/ASTNodeIndex'
import type ASTNodeTree from '../ast-state/ASTNodeTree'
import type FunctionRegistry from '../../registries/FunctionRegistry'
import type ComponentRegistry from '../../registries/ComponentRegistry'
import type { ASTValidationContext, ASTValidationRule } from './rules/types'
import { validateReferenceScopes } from './rules/validateReferenceScopes'
import { validateEffectScope } from './rules/validateEffectScope'
import { validateRegisteredFunctions } from './rules/validateRegisteredFunctions'
import { validateRegisteredComponents } from './rules/validateRegisteredComponents'

const RULES: readonly ASTValidationRule[] = [
  validateReferenceScopes,
  validateEffectScope,
  validateRegisteredFunctions,
  validateRegisteredComponents,
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
