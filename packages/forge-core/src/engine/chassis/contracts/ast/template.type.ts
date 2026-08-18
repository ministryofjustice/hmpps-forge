import { ASTNodeType } from './enums'
import { TemplateNodeId } from './ast.type'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'

/**
 * A template node preserves the shape of an AST node but with:
 * - type set to TEMPLATE (so isASTNode excludes it from traversal/registration)
 * - originalType storing the real node type (EXPRESSION, BLOCK, etc.)
 * - a template ID used as the stable generated runtime instance ID prefix
 */
export interface TemplateNode {
  type: ASTNodeType.TEMPLATE
  originalType: ASTNodeType
  id: TemplateNodeId
  diagnostics?: ASTNodeDiagnostics
  properties?: Record<string, TemplateValue>
  [key: string]: unknown
}

export type TemplateValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TemplateNode
  | TemplateValue[]
  | { [key: string]: TemplateValue }
