import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import {
  ExpressionASTNode,
  TestPredicateASTNode,
  NotPredicateASTNode,
  AndPredicateASTNode,
  OrPredicateASTNode,
  XorPredicateASTNode,
} from '@form-engine/core/types/expressions.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { LogicType } from '@form-engine/form/types/enums'
import { isPredicateNode } from '@form-engine/core/typeguards/predicate-nodes'

/**
 * LogicExpressionWiring: Wires logic/predicate expressions to their operands
 *
 * Creates dependency edges for logic operator and test nodes:
 * - TEST: Test predicates with subject and condition
 * - AND, OR, XOR: Logic operators with array of operands
 * - NOT: Unary logic operator with single operand
 *
 * Wiring pattern:
 * - SUBJECT → TEST_NODE (subject must be evaluated first)
 * - CONDITION → TEST_NODE (condition must be evaluated first)
 * - OPERANDS[i] → LOGIC_NODE (each operand must be evaluated first)
 * - OPERAND → NOT_NODE (operand must be evaluated first)
 */
export default class LogicExpressionWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all logic and test expressions to their operands
   */
  wire(): void {
    const expressionNodes = this.wiringContext.findNodesByType<ExpressionASTNode>(ASTNodeType.EXPRESSION)

    expressionNodes
      .filter(isPredicateNode)
      .forEach(predicateNode => {
        switch (predicateNode.expressionType) {
          case LogicType.TEST:
            this.wireTestPredicate(predicateNode as TestPredicateASTNode)
            break

          case LogicType.AND:
          case LogicType.OR:
          case LogicType.XOR:
            this.wireLogicOperator(predicateNode as AndPredicateASTNode | OrPredicateASTNode | XorPredicateASTNode)
            break

          case LogicType.NOT:
            this.wireUnaryOperator(predicateNode as NotPredicateASTNode)
            break

          default:
            break
        }
      })
  }

  /**
   * Wire a TEST predicate to its subject and condition
   *
   * Creates edges: subject → test, condition → test
   */
  private wireTestPredicate(testNode: TestPredicateASTNode) {
    const subject = testNode.properties.subject
    const condition = testNode.properties.condition

    if (isASTNode(subject)) {
      this.wiringContext.graph.addEdge(subject.id, testNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'subject',
      })
    }

    if (isASTNode(condition)) {
      this.wiringContext.graph.addEdge(condition.id, testNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'condition',
      })
    }
  }

  /**
   * Wire a logic operator (AND, OR, XOR) to its operands
   * All three operators have identical structure and are handled the same way
   *
   * Creates edges: operands[i] → operator
   */
  private wireLogicOperator(predicateNode: AndPredicateASTNode | OrPredicateASTNode | XorPredicateASTNode) {
    const operands = predicateNode.properties.operands

    operands.filter(isASTNode).forEach((operand, index) => {
      this.wiringContext.graph.addEdge(operand.id, predicateNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'operands',
        index,
      })
    })
  }

  /**
   * Wire a unary logic operator (NOT) to its operand
   *
   * Creates edge: operand → operator
   */
  private wireUnaryOperator(notNode: NotPredicateASTNode) {
    const operand = notNode.properties.operand

    if (isASTNode(operand)) {
      this.wiringContext.graph.addEdge(operand.id, notNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'operand',
      })
    }
  }
}
