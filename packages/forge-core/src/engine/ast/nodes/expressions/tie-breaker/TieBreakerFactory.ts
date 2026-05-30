import { ASTNodeType } from '../../../../contracts/ast/enums'
import { ExpressionType } from '../../../../../authoring/types/enums'
import { TieBreakerASTNode } from '../../../../contracts/ast/expressions.type'
import type { TieBreaker } from '../../../../../authoring/types/structures.type'
import { NodeIDGenerator, NodeIDCategory } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'

export default class TieBreakerFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST,
  ) {}

  create(json: TieBreaker): TieBreakerASTNode {
    const properties: TieBreakerASTNode['properties'] = {
      priority: json.priority,
    }

    if (json.when !== undefined) {
      properties.when = this.nodeFactory.createNode(json.when)
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.TIE_BREAKER,
      properties,
      raw: json,
    }
  }
}
