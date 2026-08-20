import { ASTNodeType } from '../../../contracts/ast/enums'
import { OutcomeType } from '../../../../../authoring/types/enums'
import { RedirectOutcomeASTNode, ThrowErrorOutcomeASTNode } from '../../../contracts/ast/expressions.type'
import type { ASTNode } from '../../../contracts/ast/engine.type'
import { RedirectOutcome, ThrowErrorOutcome } from '../../../../../authoring/types/expressions.type'
import type { NodeBuildContext } from './NodeFactory'

/**
 * Redirect outcome: Navigation target within hooks
 * Contains optional condition and destination path.
 */
export function createRedirectOutcomeNode(json: RedirectOutcome, ctx: NodeBuildContext): RedirectOutcomeASTNode {
  const properties: { when?: ASTNode; goto: ASTNode | string } = {
    goto: ctx.transformValue(json.goto),
  }

  if (json.when) {
    properties.when = ctx.createNode(json.when)
  }

  return {
    id: ctx.nextId(),
    type: ASTNodeType.OUTCOME,
    outcomeType: OutcomeType.REDIRECT,
    properties,
  }
}

/**
 * ThrowError outcome: HTTP error response within hooks
 * Contains optional condition, required status code, and message.
 */
export function createThrowErrorOutcomeNode(json: ThrowErrorOutcome, ctx: NodeBuildContext): ThrowErrorOutcomeASTNode {
  const properties: { when?: ASTNode; status: number; message: ASTNode | string } = {
    status: json.status,
    message: typeof json.message === 'string' ? json.message : ctx.transformValue(json.message),
  }

  if (json.when) {
    properties.when = ctx.createNode(json.when)
  }

  return {
    id: ctx.nextId(),
    type: ASTNodeType.OUTCOME,
    outcomeType: OutcomeType.THROW_ERROR,
    properties,
  }
}
