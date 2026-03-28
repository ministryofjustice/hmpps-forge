import { ASTNodeType } from '@form-engine/core/types/enums'
import { OutcomeType } from '@form-engine/form/types/enums'
import { RedirectOutcomeASTNode } from '@form-engine/core/types/expressions.type'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { RedirectOutcome } from '@form-engine/form/types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'

/**
 * RedirectOutcomeFactory: Creates Redirect outcome AST nodes
 *
 * Redirect outcomes define navigation targets within transitions.
 * Contains optional condition and destination path.
 */
export default class RedirectOutcomeFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform Redirect outcome: Navigation target
   */
  create(json: RedirectOutcome): RedirectOutcomeASTNode {
    const properties: { when?: ASTNode; goto: ASTNode | string } = {
      goto: this.nodeFactory.transformValue(json.goto),
    }

    if (json.when) {
      properties.when = this.nodeFactory.createNode(json.when)
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.OUTCOME,
      outcomeType: OutcomeType.REDIRECT,
      properties,
      raw: json,
    }
  }
}
