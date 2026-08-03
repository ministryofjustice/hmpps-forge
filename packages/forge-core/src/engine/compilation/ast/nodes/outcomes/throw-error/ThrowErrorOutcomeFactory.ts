import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { OutcomeType } from '../../../../../../authoring/types/enums'
import { ThrowErrorOutcomeASTNode } from '../../../../../contracts/ast/expressions.type'
import type { ASTNode } from '../../../../../contracts/ast/engine.type'
import { ThrowErrorOutcome } from '../../../../../../authoring/types/expressions.type'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'

/**
 * ThrowErrorOutcomeFactory: Creates ThrowError outcome AST nodes
 *
 * ThrowError outcomes define HTTP error responses within hooks.
 * Contains optional condition, required status code, and message.
 */
export default class ThrowErrorOutcomeFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
  ) {}

  /**
   * Transform ThrowError outcome: Error response
   */
  create(json: ThrowErrorOutcome): ThrowErrorOutcomeASTNode {
    const properties: { when?: ASTNode; status: number; message: ASTNode | string } = {
      status: json.status,
      message: typeof json.message === 'string' ? json.message : this.nodeFactory.transformValue(json.message),
    }

    if (json.when) {
      properties.when = this.nodeFactory.createNode(json.when)
    }

    return {
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.OUTCOME,
      outcomeType: OutcomeType.THROW_ERROR,
      properties,
    }
  }
}
