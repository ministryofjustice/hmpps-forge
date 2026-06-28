import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { ExpressionType, PredicateType } from '../../../../../../authoring/types/enums'
import { MatchExpr } from '../../../../../../authoring/types/expressions.type'
import InvalidNodeError from '../../../../../errors/InvalidNodeError'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'
import { MatchASTNode } from '../../../../../contracts/ast/expressions.type'
import type { TestPredicateASTNode } from '../../../../../contracts/ast/predicates.type'

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

    const compiledBranches = json.branches.map((branch, index) => ({
      predicate: this.createBranchPredicate(json, index),
      value: this.nodeFactory.transformChild(branch.value, 'branches', index, 'value'),
    }))

    return {
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.EXPRESSION,
      expressionType: ExpressionType.MATCH,
      properties: {
        branches: compiledBranches,
        ...(json.otherwise !== undefined && {
          otherwise: this.nodeFactory.transformChild(json.otherwise, 'otherwise'),
        }),
      },
    }
  }

  private createBranchPredicate(json: MatchExpr, branchIndex: number): TestPredicateASTNode {
    return {
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.PREDICATE,
      predicateType: PredicateType.TEST,
      diagnostics: this.nodeFactory.createChildDiagnostics('branches', branchIndex, 'condition'),
      properties: {
        subject: this.nodeFactory.transformChild(json.subject, 'subject'),
        condition: this.nodeFactory.createChildNode(
          json.branches[branchIndex].condition,
          'branches',
          branchIndex,
          'condition',
        ),
        negate: false,
      },
    }
  }
}
