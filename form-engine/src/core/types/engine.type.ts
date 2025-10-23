import type Logger from 'bunyan'
import { ASTNodeType } from '@form-engine/core/types/enums'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'

export interface FormInstanceDependencies {
  componentRegistry: ComponentRegistry
  functionRegistry: FunctionRegistry
  logger: Logger | Console
}

/**
 * Base AST node interface that all nodes extend
 */
export interface ASTNode {
  type: ASTNodeType
  id?: number
  raw?: any
  parentNode?: ASTNode
}
