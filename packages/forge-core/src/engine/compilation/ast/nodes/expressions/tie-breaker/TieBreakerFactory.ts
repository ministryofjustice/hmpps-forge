import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { ExpressionType } from '../../../../../../authoring/types/enums'
import { TieBreakerASTNode } from '../../../../../contracts/ast/expressions.type'
import type { TieBreaker } from '../../../../../../authoring/types/structures.type'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'

export default class TieBreakerFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
  ) {}

  create(json: TieBreaker): TieBreakerASTNode {
    const properties: TieBreakerASTNode['properties'] = {
      priority: json.priority,
    }

    if (json.when !== undefined) {
      properties.when = this.nodeFactory.createNode(json.when)
    }

    return {
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.TIE_BREAKER,
      properties,
    }
  }
}
