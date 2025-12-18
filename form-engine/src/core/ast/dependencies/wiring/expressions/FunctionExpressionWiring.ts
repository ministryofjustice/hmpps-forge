import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionASTNode, FunctionASTNode } from '@form-engine/core/types/expressions.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isFunctionExprNode } from '@form-engine/core/typeguards/expression-nodes'

/**
 * FunctionExpressionWiring: Wires function expressions to their arguments
 *
 * Creates dependency edges for function nodes:
 * - Function expressions have a function type and arguments array
 * - Each argument must be evaluated before the function expression
 *
 * Wiring pattern:
 * - ARG_0 → FUNCTION (first argument must be evaluated first)
 * - ARG_1 → FUNCTION (second argument must be evaluated first)
 * - etc.
 */
export default class FunctionExpressionWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all function expressions to their argument nodes
   */
  wire() {
    const expressionNodes = this.wiringContext.findNodesByType<ExpressionASTNode>(ASTNodeType.EXPRESSION)

    expressionNodes
      .filter(isFunctionExprNode)
      .forEach(functionNode => {
        this.wireArguments(functionNode)
      })
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   */
  wireNodes(nodeIds: NodeId[]) {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isFunctionExprNode)
      .forEach(functionNode => {
        this.wireArguments(functionNode)
      })
  }

  /**
   * Wire a function expression to its arguments
   *
   * Creates edges: arg[0] → function, arg[1] → function, etc.
   */
  private wireArguments(functionNode: FunctionASTNode) {
    const args = functionNode.properties.arguments

    if (Array.isArray(args)) {
      args.filter(isASTNode).forEach((arg, index) => {
        this.wiringContext.graph.addEdge(arg.id, functionNode.id, DependencyEdgeType.DATA_FLOW, {
          property: 'arguments',
          index,
        })
      })
    }
  }
}
