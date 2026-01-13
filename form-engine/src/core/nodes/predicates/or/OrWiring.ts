import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isOrPredicateNode } from '@form-engine/core/typeguards/predicate-nodes'
import { PredicateASTNode, OrPredicateASTNode } from '@form-engine/core/types/predicates.type'

/**
 * OrWiring: Wires OR predicate expressions to their operands
 *
 * Creates dependency edges for OR nodes:
 * - OR predicates have an array of operands that must all be evaluated
 *
 * Wiring pattern:
 * - OPERANDS[i] → OR_NODE (each operand must be evaluated first)
 */
export default class OrWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  wire(): void {
    const logicNodes = this.wiringContext.nodeRegistry.findByType<PredicateASTNode>(ASTNodeType.PREDICATE)

    logicNodes.filter(isOrPredicateNode).forEach(orNode => {
      this.wireOr(orNode)
    })
  }

  wireNodes(nodeIds: NodeId[]): void {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isOrPredicateNode)
      .forEach(orNode => {
        this.wireOr(orNode)
      })
  }

  private wireOr(orNode: OrPredicateASTNode): void {
    const operands = orNode.properties.operands

    operands.filter(isASTNode).forEach((operand, index) => {
      this.wiringContext.graph.addEdge(operand.id, orNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'operands',
        index,
      })
    })
  }
}
