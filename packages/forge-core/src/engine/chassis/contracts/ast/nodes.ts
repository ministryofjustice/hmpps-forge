import {
  ComponentCallType,
  ExpressionType,
  FunctionCallType,
  HookType,
  PolicyType,
  PredicateType,
  StructureType,
} from '../../../../shared/taxonomy'
import type { ASTNode, MaterialisedASTNode, TemplateASTNode } from './ast.type'
import type { ASTNodeKind } from './enums'

const AST_NODE_KINDS: ReadonlySet<string> = new Set([
  ...Object.values(StructureType),
  ...Object.values(ComponentCallType),
  ...Object.values(ExpressionType),
  ...Object.values(FunctionCallType),
  ...Object.values(PredicateType),
  ...Object.values(HookType),
  PolicyType.VALIDATION_RULE,
  PolicyType.NAVIGATION_TIE_BREAKER,
  PolicyType.OUTCOME_REDIRECT,
  PolicyType.OUTCOME_THROW_ERROR,
])

/**
 * Check if a value is either a materialised or template AST node.
 */
export function isASTNode(value: unknown): value is ASTNode {
  if (value === null || value === undefined || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>

  if (typeof candidate.kind !== 'string' || !AST_NODE_KINDS.has(candidate.kind)) {
    return false
  }

  if (candidate.isTemplate === false) {
    return typeof candidate.id === 'string' && candidate.id.startsWith('compile_ast:')
  }

  return candidate.isTemplate === true && typeof candidate.id === 'string' && candidate.id.startsWith('template:')
}

export function isMaterialisedASTNode(value: unknown): value is MaterialisedASTNode {
  return isASTNode(value) && value.isTemplate === false
}

export function isTemplateASTNode(value: unknown): value is TemplateASTNode {
  return isASTNode(value) && value.isTemplate === true
}

export function isASTNodeKind(value: unknown): value is ASTNodeKind {
  return typeof value === 'string' && AST_NODE_KINDS.has(value)
}
