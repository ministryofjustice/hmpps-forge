import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isAndPredicateNode } from '@form-engine/core/typeguards/predicate-nodes'
import { AndPredicateASTNode, PredicateASTNode } from '@form-engine/core/types/predicates.type'

/**
 * AndWiring: Wires AND predicate expressions to their operands
 *
 * Creates dependency edges for AND nodes:
 * - AND predicates have an array of operands that must all be evaluated
 *
 * Wiring pattern:
 * - OPERANDS[i] → AND_NODE (each operand must be evaluated first)
 */
export default class AndWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  wire(): void {
    const logicNodes = this.wiringContext.nodeRegistry.findByType<PredicateASTNode>(ASTNodeType.PREDICATE)

    logicNodes.filter(isAndPredicateNode).forEach(andNode => {
      this.wireAnd(andNode)
    })
  }

  wireNodes(nodeIds: NodeId[]): void {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isAndPredicateNode)
      .forEach(andNode => {
        this.wireAnd(andNode)
      })
  }

  private wireAnd(andNode: AndPredicateASTNode): void {
    const operands = andNode.properties.operands

    operands.filter(isASTNode).forEach((operand, index) => {
      this.wiringContext.graph.addEdge(operand.id, andNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'operands',
        index,
      })
    })
  }
}
