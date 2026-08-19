import type ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import type FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import type ComponentRegistry from '../../../chassis/registries/ComponentRegistry'

export interface ASTValidationContext {
  readonly nodeIndex: ASTNodeIndex
  readonly functionRegistry: FunctionRegistry
  readonly componentRegistry: ComponentRegistry
}

export type ASTValidationRule = (context: ASTValidationContext) => readonly Error[]
