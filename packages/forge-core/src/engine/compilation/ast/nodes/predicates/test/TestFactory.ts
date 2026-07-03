import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { PredicateType } from '../../../../../../authoring/types/enums'
import { PredicateTestExpr } from '../../../../../../authoring/types/expressions.type'
import InvalidNodeError from '../../../../../errors/InvalidNodeError'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'
import { TestPredicateASTNode } from '../../../../../contracts/ast/predicates.type'

/**
 * TestFactory: Creates Test predicate AST nodes
 *
 * Test predicates evaluate subject.condition with optional negation.
 * Defaults: negate = false
 */
export default class TestFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
  ) {}

  /**
   * Transform TEST predicate: subject.condition with optional negation
   */
  create(json: PredicateTestExpr): TestPredicateASTNode {
    if (!json.subject) {
      throw new InvalidNodeError({
        message: 'Test predicate requires a subject',
        node: json,
        expected: 'subject property',
        actual: 'undefined',
      })
    }

    if (!json.condition) {
      throw new InvalidNodeError({
        message: 'Test predicate requires a condition',
        node: json,
        expected: 'condition property',
        actual: 'undefined',
      })
    }

    return {
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.PREDICATE,
      predicateType: PredicateType.TEST,
      properties: {
        // Use transformValue to support both AST nodes and literals
        subject: this.nodeFactory.transformChild(json.subject, 'subject'),
        condition: this.nodeFactory.createChildNode(json.condition, 'condition'),
        negate: json.negate ?? false,
      },
    }
  }
}
