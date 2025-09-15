import type ComponentRegistry from '@form-engine/core/registry/ComponentRegistry'
import type FunctionRegistry from '@form-engine/core/registry/FunctionRegistry'
import type Logger from 'bunyan'
import { ASTNodeType } from '@form-engine/core/types/enums'

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
  id?: string
  raw?: any
}

export type CompiledAST = object
