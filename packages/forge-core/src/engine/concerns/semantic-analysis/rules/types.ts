import type ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import type TemplateNodeIndex from '../../../chassis/compilation/ast/ast-state/TemplateNodeIndex'
import type FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import type ComponentRegistry from '../../../chassis/registries/ComponentRegistry'

export interface ASTValidationContext {
  readonly nodeIndex: ASTNodeIndex
  readonly templateNodeIndex: TemplateNodeIndex
  readonly functionRegistry: FunctionRegistry
  readonly componentRegistry: ComponentRegistry
}

export type ASTValidationRule = (context: ASTValidationContext) => readonly Error[]
