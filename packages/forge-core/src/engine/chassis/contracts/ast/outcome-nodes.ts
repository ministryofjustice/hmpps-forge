import { PolicyType } from '../../../../shared/taxonomy'
import { OutcomeASTNode, RedirectOutcomeASTNode, ThrowErrorOutcomeASTNode } from './expressions.type'

/**
 * Check if an AST node is any type of Outcome node
 */
function isOutcomeNode(obj: unknown): obj is OutcomeASTNode {
  return obj !== null &&
    obj !== undefined &&
    typeof obj === 'object' &&
    'kind' in obj &&
    typeof obj.kind === 'string' &&
    obj.kind.startsWith('policy.outcome.')
}

/**
 * Check if an AST node is a Redirect Outcome node
 */
export function isRedirectOutcomeNode(obj: unknown): obj is RedirectOutcomeASTNode {
  return isOutcomeNode(obj) && obj.kind === PolicyType.OUTCOME_REDIRECT
}

/**
 * Check if an AST node is a ThrowError Outcome node
 */
export function isThrowErrorOutcomeNode(obj: unknown): obj is ThrowErrorOutcomeASTNode {
  return isOutcomeNode(obj) && obj.kind === PolicyType.OUTCOME_THROW_ERROR
}
