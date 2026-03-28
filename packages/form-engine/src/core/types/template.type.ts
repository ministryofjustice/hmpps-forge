import { ASTNodeType } from '@form-engine/core/types/enums'
import { TemplateNodeId } from '@form-engine/core/types/engine.type'

/**
 * A template node preserves the shape of an AST node but with:
 * - type set to TEMPLATE (so isASTNode excludes it from traversal/registration)
 * - originalType storing the real node type (EXPRESSION, BLOCK, etc.)
 * - a template ID for tracking
 */
export interface TemplateNode {
  type: ASTNodeType.TEMPLATE
  originalType: ASTNodeType
  id: TemplateNodeId
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
