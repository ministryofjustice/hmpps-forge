import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { IterateASTNode, ExpressionASTNode } from '@form-engine/core/types/expressions.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isIterateExprNode } from '@form-engine/core/typeguards/expression-nodes'

/**
 * IterateWiring: Wires iterate expressions to their dependencies
 *
 * Creates dependency edges for iterate nodes:
 * - The input source must be evaluated before iteration
 *
 * Wiring pattern for ITERATE:
 * - INPUT → ITERATE_NODE (input must be evaluated first)
 *
 * Note: yield/predicate are stored as raw JSON and instantiated at runtime,
 * similar to Collection.template. No compile-time wiring needed for them.
 * TODO: I think at some point i'll change this to pre-make the nodes, and then
 *  just dynamically give em IDs at runtime
 */
export default class IterateWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all iterate expressions to their input nodes
   */
  wire() {
    const expressionNodes = this.wiringContext.nodeRegistry.findByType<ExpressionASTNode>(ASTNodeType.EXPRESSION)

    expressionNodes.filter(isIterateExprNode).forEach(iterateNode => {
      this.wireIterate(iterateNode)
    })
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   */
  wireNodes(nodeIds: NodeId[]) {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isIterateExprNode)
      .forEach(iterateNode => {
        this.wireIterate(iterateNode)
      })
  }

  /**
   * Wire an iterate expression to its input source dependency
   *
   * Creates edge: input → iterateNode
   */
  private wireIterate(iterateNode: IterateASTNode) {
    const input = iterateNode.properties.input

    // Wire input → iterateNode (input must be evaluated before iteration)
    if (isASTNode(input)) {
      this.wiringContext.graph.addEdge(input.id, iterateNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'input',
      })
    }
  }
}
