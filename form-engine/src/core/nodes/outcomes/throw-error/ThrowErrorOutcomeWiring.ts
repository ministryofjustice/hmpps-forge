import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { OutcomeASTNode, ThrowErrorOutcomeASTNode } from '@form-engine/core/types/expressions.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isThrowErrorOutcomeNode } from '@form-engine/core/typeguards/outcome-nodes'

/**
 * ThrowErrorOutcomeWiring: Wires ThrowError outcome nodes to their dependencies
 *
 * Creates dependency edges for throw error outcome nodes:
 * - ThrowError outcomes have an optional 'when' condition
 * - ThrowError outcomes have a 'message' (can be AST node or string)
 * - ThrowError outcomes have a 'status' (always a number, no wiring needed)
 *
 * Wiring pattern:
 * - WHEN → THROW_ERROR (condition must be evaluated first)
 * - MESSAGE → THROW_ERROR (if message is an AST node, it must be evaluated first)
 */
export default class ThrowErrorOutcomeWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all throw error outcome nodes to their dependencies
   */
  wire() {
    const outcomeNodes = this.wiringContext.nodeRegistry.findByType<OutcomeASTNode>(ASTNodeType.OUTCOME)

    outcomeNodes
      .filter(isThrowErrorOutcomeNode)
      .forEach(throwErrorNode => {
        this.wireThrowErrorOutcome(throwErrorNode)
      })
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   */
  wireNodes(nodeIds: NodeId[]) {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isThrowErrorOutcomeNode)
      .forEach(throwErrorNode => {
        this.wireThrowErrorOutcome(throwErrorNode)
      })
  }

  /**
   * Wire a throw error outcome to its dependencies
   *
   * Creates edges:
   * - when → throwError (condition must be evaluated before throwError)
   * - message → throwError (if message is an AST node)
   */
  private wireThrowErrorOutcome(throwErrorNode: ThrowErrorOutcomeASTNode) {
    const when = throwErrorNode.properties.when
    const message = throwErrorNode.properties.message

    // Wire when → throwError (condition must be evaluated first)
    if (isASTNode(when)) {
      this.wiringContext.graph.addEdge(when.id, throwErrorNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
    }

    // Wire message → throwError (if message is an AST node, it must be evaluated first)
    if (isASTNode(message)) {
      this.wiringContext.graph.addEdge(message.id, throwErrorNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'message',
      })
    }
  }
}
