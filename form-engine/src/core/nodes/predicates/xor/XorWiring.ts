import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isXorPredicateNode } from '@form-engine/core/typeguards/predicate-nodes'
import { PredicateASTNode, XorPredicateASTNode } from '@form-engine/core/types/predicates.type'

/**
 * XorWiring: Wires XOR predicate expressions to their operands
 *
 * Creates dependency edges for XOR nodes:
 * - XOR predicates have an array of operands that must all be evaluated
 *
 * Wiring pattern:
 * - OPERANDS[i] → XOR_NODE (each operand must be evaluated first)
 */
export default class XorWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  wire(): void {
    const logicNodes = this.wiringContext.nodeRegistry.findByType<PredicateASTNode>(ASTNodeType.PREDICATE)

    logicNodes.filter(isXorPredicateNode).forEach(xorNode => {
      this.wireXor(xorNode)
    })
  }

  wireNodes(nodeIds: NodeId[]): void {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isXorPredicateNode)
      .forEach(xorNode => {
        this.wireXor(xorNode)
      })
  }

  private wireXor(xorNode: XorPredicateASTNode): void {
    const operands = xorNode.properties.operands

    operands.filter(isASTNode).forEach((operand, index) => {
      this.wiringContext.graph.addEdge(operand.id, xorNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'operands',
        index,
      })
    })
  }
}
