import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { OutcomeType } from '../../../../../../authoring/types/enums'
import { RedirectOutcomeASTNode } from '../../../../../contracts/ast/expressions.type'
import type { ASTNode } from '../../../../../contracts/ast/engine.type'
import { RedirectOutcome } from '../../../../../../authoring/types/expressions.type'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'

/**
 * RedirectOutcomeFactory: Creates Redirect outcome AST nodes
 *
 * Redirect outcomes define navigation targets within hooks.
 * Contains optional condition and destination path.
 */
export default class RedirectOutcomeFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
  ) {}

  /**
   * Transform Redirect outcome: Navigation target
   */
  create(json: RedirectOutcome): RedirectOutcomeASTNode {
    const properties: { when?: ASTNode; goto: ASTNode | string } = {
      goto: this.nodeFactory.transformChild(json.goto, 'goto'),
    }

    if (json.when) {
      properties.when = this.nodeFactory.createChildNode(json.when, 'when')
    }

    return {
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.OUTCOME,
      outcomeType: OutcomeType.REDIRECT,
      properties,
    }
  }
}
