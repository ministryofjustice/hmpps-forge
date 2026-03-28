import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, PredicateType } from '@form-engine/form/types/enums'
import { MatchExpr } from '@form-engine/form/types/expressions.type'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { MatchASTNode } from '@form-engine/core/types/expressions.type'

/**
 * MatchFactory: Creates Match AST nodes
 *
 * Match expressions evaluate a subject against multiple branches,
 * returning the value of the first branch whose condition matches.
 *
 * For each branch, the factory synthesises a PredicateTestExpr by
 * combining the shared subject with the branch's condition, reusing
 * the existing predicate infrastructure.
 */
export default class MatchFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  create(json: MatchExpr): MatchASTNode {
    if (!json.subject) {
      throw new InvalidNodeError({
        message: 'Match expression requires a subject',
        node: json,
        expected: 'subject property',
        actual: 'undefined',
      })
    }

    if (!json.branches || json.branches.length === 0) {
      throw new InvalidNodeError({
        message: 'Match expression requires at least one branch',
        node: json,
        expected: 'non-empty branches array',
        actual: json.branches ? 'empty array' : 'undefined',
      })
    }

    const compiledBranches = json.branches.map(branch => ({
      predicate: this.nodeFactory.createNode({
        type: PredicateType.TEST,
        subject: json.subject,
        negate: false,
        condition: branch.condition,
      }),
      value: this.nodeFactory.transformValue(branch.value),
    }))

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.MATCH,
      properties: {
        branches: compiledBranches,
        ...(json.otherwise !== undefined && {
          otherwise: this.nodeFactory.transformValue(json.otherwise),
        }),
      },
      raw: json,
    }
  }
}
