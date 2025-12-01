import {
  isPredicateTestExpr,
  isPredicateNotExpr,
  isPredicateAndExpr,
  isPredicateOrExpr,
  isPredicateXorExpr,
} from '@form-engine/form/typeguards/predicates'
import { isConditionalExpr } from '@form-engine/form/typeguards/expressions'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { LogicType } from '@form-engine/form/types/enums'
import {
  ConditionalASTNode,
  TestPredicateASTNode,
  NotPredicateASTNode,
  AndPredicateASTNode,
  OrPredicateASTNode,
  XorPredicateASTNode,
} from '@form-engine/core/types/expressions.type'
import UnknownNodeTypeError from '@form-engine/errors/UnknownNodeTypeError'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import {
  ConditionalExpr,
  PredicateAndExpr,
  PredicateNotExpr,
  PredicateOrExpr,
  PredicateTestExpr,
  PredicateXorExpr,
} from '@form-engine/form/types/expressions.type'
import { NodeFactory } from '../NodeFactory'

/**
 * LogicNodeFactory: Creates logic nodes (Conditional, Predicates)
 * Handles boolean logic and conditional expressions
 */
export class LogicNodeFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Create a logic node based on the JSON type
   */
  create(
    json: any,
  ):
    | ConditionalASTNode
    | TestPredicateASTNode
    | NotPredicateASTNode
    | AndPredicateASTNode
    | OrPredicateASTNode
    | XorPredicateASTNode {
    if (isConditionalExpr(json)) {
      return this.createConditional(json)
    }

    if (isPredicateTestExpr(json)) {
      return this.createTestPredicate(json)
    }

    if (isPredicateNotExpr(json)) {
      return this.createNotPredicate(json)
    }

    if (isPredicateAndExpr(json)) {
      return this.createAndPredicate(json)
    }

    if (isPredicateOrExpr(json)) {
      return this.createOrPredicate(json)
    }

    if (isPredicateXorExpr(json)) {
      return this.createXorPredicate(json)
    }

    throw new UnknownNodeTypeError({
      nodeType: json?.type,
      node: json,
      validTypes: ['Conditional', 'Test', 'And', 'Or', 'Xor', 'Not'],
    })
  }

  /**
   * Transform Conditional expression: If-then-else logic
   * Evaluates predicate to choose between two values
   * Defaults: thenValue = true, elseValue = false
   */
  private createConditional(json: ConditionalExpr): ConditionalASTNode {
    if (!json.predicate) {
      throw new InvalidNodeError({
        message: 'Conditional expression requires a predicate',
        node: json,
        expected: 'predicate property',
        actual: 'undefined',
      })
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: LogicType.CONDITIONAL,
      properties: {
        predicate: this.nodeFactory.createNode(json.predicate),
        thenValue: json.thenValue !== undefined ? this.nodeFactory.transformValue(json.thenValue) : true,
        elseValue: json.elseValue !== undefined ? this.nodeFactory.transformValue(json.elseValue) : false,
      },
      raw: json,
    }
  }

  /**
   * Transform TEST predicate: subject.condition with optional negation
   * Defaults: negate = false
   */
  private createTestPredicate(json: PredicateTestExpr): TestPredicateASTNode {
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
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: LogicType.TEST,
      properties: {
        subject: this.nodeFactory.createNode(json.subject),
        condition: this.nodeFactory.createNode(json.condition),
        negate: json.negate ?? false,
      },
      raw: json,
    }
  }

  /**
   * Transform NOT predicate: Single operand negation
   */
  private createNotPredicate(json: PredicateNotExpr): NotPredicateASTNode {
    if (!json.operand) {
      throw new InvalidNodeError({
        message: 'Not predicate requires an operand',
        node: json,
        expected: 'operand property',
        actual: 'undefined',
      })
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: LogicType.NOT,
      properties: {
        operand: this.nodeFactory.createNode(json.operand),
      },
      raw: json,
    }
  }

  /**
   * Transform AND predicate: Multiple operands (min 2)
   */
  private createAndPredicate(json: PredicateAndExpr): AndPredicateASTNode {
    if (!json.operands || !Array.isArray(json.operands) || json.operands.length === 0) {
      throw new InvalidNodeError({
        message: 'And predicate requires a non-empty operands array',
        node: json,
        expected: 'operands array with at least one element',
        actual: json.operands ? `array with ${json.operands.length} elements` : 'undefined',
      })
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: LogicType.AND,
      properties: {
        operands: json.operands.map((operand: any) => this.nodeFactory.createNode(operand)),
      },
      raw: json,
    }
  }

  /**
   * Transform OR predicate: Multiple operands (min 2)
   */
  private createOrPredicate(json: PredicateOrExpr): OrPredicateASTNode {
    if (!json.operands || !Array.isArray(json.operands) || json.operands.length === 0) {
      throw new InvalidNodeError({
        message: 'Or predicate requires a non-empty operands array',
        node: json,
        expected: 'operands array with at least one element',
        actual: json.operands ? `array with ${json.operands.length} elements` : 'undefined',
      })
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: LogicType.OR,
      properties: {
        operands: json.operands.map((operand: any) => this.nodeFactory.createNode(operand)),
      },
      raw: json,
    }
  }

  /**
   * Transform XOR predicate: Multiple operands (min 2)
   */
  private createXorPredicate(json: PredicateXorExpr): XorPredicateASTNode {
    if (!json.operands || !Array.isArray(json.operands) || json.operands.length === 0) {
      throw new InvalidNodeError({
        message: 'Xor predicate requires a non-empty operands array',
        node: json,
        expected: 'operands array with at least one element',
        actual: json.operands ? `array with ${json.operands.length} elements` : 'undefined',
      })
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.EXPRESSION,
      expressionType: LogicType.XOR,
      properties: {
        operands: json.operands.map((operand: any) => this.nodeFactory.createNode(operand)),
      },
      raw: json,
    }
  }
}
