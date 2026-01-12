import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionASTNode, FormatASTNode } from '@form-engine/core/types/expressions.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isFormatExprNode } from '@form-engine/core/typeguards/expression-nodes'

/**
 * FormatWiring: Wires format expressions to their arguments
 *
 * Creates dependency edges for format nodes:
 * - Format expressions have a template string and arguments array
 * - Each argument must be evaluated before the format expression
 *
 * Wiring pattern:
 * - ARG_0 → FORMAT (first argument must be evaluated first)
 * - ARG_1 → FORMAT (second argument must be evaluated first)
 * - etc.
 */
export default class FormatWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all format expressions to their argument nodes
   */
  wire() {
    const expressionNodes = this.wiringContext.nodeRegistry.findByType<ExpressionASTNode>(ASTNodeType.EXPRESSION)

    expressionNodes
      .filter(isFormatExprNode)
      .forEach(formatNode => {
        this.wireArguments(formatNode)
      })
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   */
  wireNodes(nodeIds: NodeId[]) {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isFormatExprNode)
      .forEach(formatNode => {
        this.wireArguments(formatNode)
      })
  }

  /**
   * Wire a format expression to its arguments
   *
   * Creates edges: arg[0] → format, arg[1] → format, etc.
   */
  private wireArguments(formatNode: FormatASTNode) {
    const args = formatNode.properties.arguments

    if (Array.isArray(args)) {
      args.filter(isASTNode).forEach((arg, index) => {
        this.wiringContext.graph.addEdge(arg.id, formatNode.id, DependencyEdgeType.DATA_FLOW, {
          property: 'arguments',
          index,
        })
      })
    }
  }
}
