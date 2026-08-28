import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTNodeKind } from './enums'

export type CompileAstNodeId = `compile_ast:${number}`
export type TemplateNodeId = `template:${number}`
type CompiledNodeId = `compiled:${string}`

export type NodeId = CompileAstNodeId | CompiledNodeId
export type AstNodeId = CompileAstNodeId

export interface BaseASTNode {
  readonly kind: ASTNodeKind
  readonly isTemplate: boolean
  readonly diagnostics?: ASTNodeDiagnostics
  readonly properties?: Record<string, unknown>
}

export interface MaterialisedASTNode extends BaseASTNode {
  readonly isTemplate: false
  readonly id: AstNodeId
  /**
   * Direct parent in the registered AST. Assigned top-down as a
   * non-enumerable field before the node is frozen.
   */
  readonly parent?: MaterialisedASTNode
}

export interface TemplateASTNode extends BaseASTNode {
  readonly isTemplate: true
  readonly id: TemplateNodeId
  readonly parent?: never
}

export type ASTNode = MaterialisedASTNode | TemplateASTNode
