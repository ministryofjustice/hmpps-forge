import { ASTNode } from './engine.type'
import { ASTNodeType } from './enums'
import type { TemplateNode } from './template.type'

const AST_NODE_TYPES: ReadonlySet<string> = new Set(Object.values(ASTNodeType))

/**
 * Check if a value is an AST node (excludes template nodes)
 */
export function isASTNode(value: any): value is ASTNode {
  return value != null &&
    typeof value === 'object' &&
    typeof value.type === 'string' &&
    value.type !== ASTNodeType.TEMPLATE &&
    AST_NODE_TYPES.has(value.type)
}

/**
 * Check if a value is a template node
 */
export function isTemplateNode(value: unknown): value is TemplateNode {
  return value != null && typeof value === 'object' && 'type' in value && value.type === ASTNodeType.TEMPLATE
}
