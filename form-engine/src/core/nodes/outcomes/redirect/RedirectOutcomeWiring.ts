import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { OutcomeASTNode, RedirectOutcomeASTNode } from '@form-engine/core/types/expressions.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isRedirectOutcomeNode } from '@form-engine/core/typeguards/outcome-nodes'

/**
 * RedirectOutcomeWiring: Wires Redirect outcome nodes to their dependencies
 *
 * Creates dependency edges for redirect outcome nodes:
 * - Redirect outcomes have an optional 'when' condition
 * - Redirect outcomes have a 'goto' destination (can be AST node or string)
 *
 * Wiring pattern:
 * - WHEN → REDIRECT (condition must be evaluated first)
 * - GOTO → REDIRECT (if goto is an AST node, it must be evaluated first)
 */
export default class RedirectOutcomeWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all redirect outcome nodes to their dependencies
   */
  wire() {
    const outcomeNodes = this.wiringContext.nodeRegistry.findByType<OutcomeASTNode>(ASTNodeType.OUTCOME)

    outcomeNodes
      .filter(isRedirectOutcomeNode)
      .forEach(redirectNode => {
        this.wireRedirectOutcome(redirectNode)
      })
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   */
  wireNodes(nodeIds: NodeId[]) {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isRedirectOutcomeNode)
      .forEach(redirectNode => {
        this.wireRedirectOutcome(redirectNode)
      })
  }

  /**
   * Wire a redirect outcome to its dependencies
   *
   * Creates edges:
   * - when → redirect (condition must be evaluated before redirect)
   * - goto → redirect (if goto is an AST node)
   */
  private wireRedirectOutcome(redirectNode: RedirectOutcomeASTNode) {
    const when = redirectNode.properties.when
    const goto = redirectNode.properties.goto

    // Wire when → redirect (condition must be evaluated first)
    if (isASTNode(when)) {
      this.wiringContext.graph.addEdge(when.id, redirectNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
    }

    // Wire goto → redirect (if goto is an AST node, it must be evaluated first)
    if (isASTNode(goto)) {
      this.wiringContext.graph.addEdge(goto.id, redirectNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'goto',
      })
    }
  }
}
