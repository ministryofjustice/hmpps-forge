import { ASTNodeType } from './enums'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'

/**
 * Template literal types for enforcing NodeID structure
 */
export type CompileAstNodeId = `compile_ast:${number}`
export type TemplateNodeId = `template:${number}`
type CompiledNodeId = `compiled:${string}`

/**
 * Union of all valid NodeId formats
 */
export type NodeId = CompileAstNodeId | CompiledNodeId

/**
 * NodeIds categorized by AST node type
 */
export type AstNodeId = CompileAstNodeId

/**
 * Base AST node interface that all nodes extend
 */
export interface ASTNode {
  type: ASTNodeType
  id: AstNodeId
  diagnostics?: ASTNodeDiagnostics
  properties?: Record<string, any>
  /**
   * Direct parent in the registered AST. Assigned top-down by
   * NodeRegistrationWalker as a non-enumerable field so property walkers never
   * recurse back up the tree. Undefined on the root and on unregistered template
   * innards.
   */
  readonly parent?: ASTNode
}
