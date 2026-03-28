import { ASTNodeType } from '@form-engine/core/types/enums'
import { OutcomeType } from '@form-engine/form/types/enums'
import { ThrowErrorOutcomeASTNode } from '@form-engine/core/types/expressions.type'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { ThrowErrorOutcome } from '@form-engine/form/types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'

/**
 * ThrowErrorOutcomeFactory: Creates ThrowError outcome AST nodes
 *
 * ThrowError outcomes define HTTP error responses within transitions.
 * Contains optional condition, required status code, and message.
 */
export default class ThrowErrorOutcomeFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
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
