import { ASTNodeType } from './enums'

/**
 * Template literal types for enforcing NodeID structure
 */
export type CompileAstNodeId = `compile_ast:${number}`
export type TemplateNodeId = `template:${number}`
export type CompiledNodeId = `compiled:${string}`

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
  properties?: Record<string, any>
  raw?: any
}
