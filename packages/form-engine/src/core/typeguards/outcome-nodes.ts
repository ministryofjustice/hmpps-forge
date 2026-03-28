import { OutcomeType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import {
  OutcomeASTNode,
  RedirectOutcomeASTNode,
  ThrowErrorOutcomeASTNode,
} from '@form-engine/core/types/expressions.type'

/**
 * Check if an AST node is any type of Outcome node
 */
export function isOutcomeNode(obj: any): obj is OutcomeASTNode {
  return obj != null && obj.type === ASTNodeType.OUTCOME
}

/**
 * Check if an AST node is a Redirect Outcome node
 */
export function isRedirectOutcomeNode(obj: any): obj is RedirectOutcomeASTNode {
  return isOutcomeNode(obj) && obj.outcomeType === OutcomeType.REDIRECT
}

/**
 * Check if an AST node is a ThrowError Outcome node
 */
export function isThrowErrorOutcomeNode(obj: any): obj is ThrowErrorOutcomeASTNode {
  return isOutcomeNode(obj) && obj.outcomeType === OutcomeType.THROW_ERROR
}
