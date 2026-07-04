import type ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type ComponentRegistry from '../../../registries/ComponentRegistry'

export interface ASTValidationContext {
  readonly nodeIndex: ASTNodeIndex
  readonly functionRegistry: FunctionRegistry
  readonly componentRegistry: ComponentRegistry
}

export type ASTValidationRule = (context: ASTValidationContext) => readonly Error[]
