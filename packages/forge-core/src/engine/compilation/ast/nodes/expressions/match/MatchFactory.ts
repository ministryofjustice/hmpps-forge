import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { ConditionCombinatorType, ExpressionType, PredicateType } from '../../../../../../authoring/types/enums'
import {
  ConditionAndExpr,
  ConditionBranchExpr,
  ConditionFunctionExpr,
  ConditionNotExpr,
  ConditionOrExpr,
  ConditionXorExpr,
  MatchExpr,
  ResolvableValue,
} from '../../../../../../authoring/types/expressions.type'
import {
  isConditionCombinatorExpr,
  isConditionNotExpr,
} from '../../../../../../authoring/typeguards/conditionCombinators'
import InvalidNodeError from '../../../../../errors/InvalidNodeError'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'
import { MatchASTNode } from '../../../../../contracts/ast/expressions.type'
import type {
  AndPredicateASTNode,
  NotPredicateASTNode,
  OrPredicateASTNode,
  PredicateASTNode,
  TestPredicateASTNode,
  XorPredicateASTNode,
} from '../../../../../contracts/ast/predicates.type'

/** The shared match subject and branch position every synthesised predicate needs. */
interface BranchConditionContext {
  subject: ResolvableValue
  branchIndex: number
}

/**
 * MatchFactory: Creates Match AST nodes
 *
 * Match expressions evaluate a subject against multiple branches,
 * returning the value of the first branch whose condition matches.
 *
 * A branch condition is either a single condition or a subject-less combinator
 * tree over conditions. The factory expands that tree into the predicate nodes
 * the engine already understands: each condition leaf becomes a TEST predicate
 * pairing the shared match subject with the leaf, and each combinator becomes
 * the matching AND/OR/XOR/NOT predicate over its expanded operands.
 */
export default class MatchFactory {
  private static readonly LOGICAL_PREDICATE_TYPES = {
    [ConditionCombinatorType.AND]: PredicateType.AND,
    [ConditionCombinatorType.OR]: PredicateType.OR,
    [ConditionCombinatorType.XOR]: PredicateType.XOR,
  } as const

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

  private createBranchPredicate(json: MatchExpr, branchIndex: number): PredicateASTNode {
    return this.expandCondition(json.branches[branchIndex].condition, { subject: json.subject, branchIndex })
  }

  private expandCondition(condition: ConditionBranchExpr, context: BranchConditionContext): PredicateASTNode {
    if (isConditionNotExpr(condition)) {
      return this.createNotPredicate(condition, context)
    }

    if (isConditionCombinatorExpr(condition)) {
      return this.createLogicalPredicate(condition, context)
    }

    return this.createTestPredicate(condition, context)
  }

  private createTestPredicate(condition: ConditionFunctionExpr, context: BranchConditionContext): TestPredicateASTNode {
    return {
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.PREDICATE,
      predicateType: PredicateType.TEST,
      diagnostics: this.createBranchDiagnostics(context),
      properties: {
        subject: this.nodeFactory.transformChild(context.subject, 'subject'),
        condition: this.nodeFactory.createChildNode(condition, 'branches', context.branchIndex, 'condition'),
        negate: false,
      },
    }
  }

  private createNotPredicate(combinator: ConditionNotExpr, context: BranchConditionContext): NotPredicateASTNode {
    return {
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.PREDICATE,
      predicateType: PredicateType.NOT,
      diagnostics: this.createBranchDiagnostics(context),
      properties: {
        operand: this.expandCondition(combinator.operand, context),
      },
    }
  }

  private createLogicalPredicate(
    combinator: ConditionAndExpr | ConditionOrExpr | ConditionXorExpr,
    context: BranchConditionContext,
  ): AndPredicateASTNode | OrPredicateASTNode | XorPredicateASTNode {
    return {
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.PREDICATE,
      predicateType: MatchFactory.LOGICAL_PREDICATE_TYPES[combinator.type],
      diagnostics: this.createBranchDiagnostics(context),
      properties: {
        operands: combinator.operands.map(operand => this.expandCondition(operand, context)),
      },
    }
  }

  private createBranchDiagnostics(context: BranchConditionContext) {
    return this.nodeFactory.createChildDiagnostics('branches', context.branchIndex, 'condition')
  }
}
