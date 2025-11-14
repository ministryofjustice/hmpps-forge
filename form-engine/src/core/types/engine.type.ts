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
  id: AstNodeId
  properties?: Record<string, any>
  raw?: any
}

/**
 * Template literal types for enforcing NodeID structure
 */
export type CompileAstNodeId = `compile_ast:${number}`
export type CompilePseudoNodeId = `compile_pseudo:${number}`
export type RuntimeAstNodeId = `runtime_ast:${number}`
export type RuntimePseudoNodeId = `runtime_pseudo:${number}`

/**
 * Union of all valid NodeId formats
 */
export type NodeId = CompileAstNodeId | CompilePseudoNodeId | RuntimeAstNodeId | RuntimePseudoNodeId

/**
 * NodeIds categorized by AST vs Pseudo node type
 */
export type AstNodeId = CompileAstNodeId | RuntimeAstNodeId
export type PseudoNodeId = CompilePseudoNodeId | RuntimePseudoNodeId
