import type ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import type TemplateNodeIndex from '../../../chassis/compilation/ast/ast-state/TemplateNodeIndex'
import type { FunctionDefinitionLookup } from '../../../../authoring/types/functions.type'
import type ComponentRegistry from '../../../chassis/registries/ComponentRegistry'

export interface ASTValidationContext {
  readonly nodeIndex: ASTNodeIndex
  readonly templateNodeIndex: TemplateNodeIndex
  readonly functionRegistry: FunctionDefinitionLookup
  readonly componentRegistry: ComponentRegistry
}

export type ASTValidationRule = (context: ASTValidationContext) => readonly Error[]
