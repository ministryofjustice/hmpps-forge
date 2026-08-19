import { OutcomeType } from '../../../../authoring/types/enums'
import { ASTNodeType } from './enums'
import { OutcomeASTNode, RedirectOutcomeASTNode, ThrowErrorOutcomeASTNode } from './expressions.type'

/**
 * Check if an AST node is any type of Outcome node
 */
function isOutcomeNode(obj: any): obj is OutcomeASTNode {
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
