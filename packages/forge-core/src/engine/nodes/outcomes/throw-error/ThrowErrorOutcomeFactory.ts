import { ASTNodeType } from '../../../types/enums'
import { OutcomeType } from '../../../../authoring/types/enums'
import { ThrowErrorOutcomeASTNode } from '../../../types/expressions.type'
import { ASTNode } from '../../../types/engine.type'
import { ThrowErrorOutcome } from '../../../../authoring/types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '../../../compilation/id-generators/NodeIDGenerator'
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
    private readonly category: NodeIDCategory.COMPILE_AST,
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
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.OUTCOME,
      outcomeType: OutcomeType.THROW_ERROR,
      properties,
      raw: json,
    }
  }
}
