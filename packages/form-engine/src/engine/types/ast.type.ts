import { ASTNodeType } from './enums'

/**
 * Template literal types for enforcing NodeID structure
 */
export type CompileAstNodeId = `compile_ast:${number}`
export type CompilePseudoNodeId = `compile_pseudo:${number}`
export type RuntimeAstNodeId = `runtime_ast:${number}`
export type RuntimePseudoNodeId = `runtime_pseudo:${number}`
export type TemplateNodeId = `template:${number}`

/**
 * Union of all valid NodeId formats
 */
export type NodeId = CompileAstNodeId | CompilePseudoNodeId | RuntimeAstNodeId | RuntimePseudoNodeId

/**
 * NodeIds categorized by AST vs Pseudo node type
 */
export type AstNodeId = CompileAstNodeId | RuntimeAstNodeId
export type PseudoNodeId = CompilePseudoNodeId | RuntimePseudoNodeId

/**
 * Base AST node interface that all nodes extend
 */
export interface ASTNode {
  type: ASTNodeType
  id: AstNodeId
  properties?: Record<string, any>
  raw?: any
}
