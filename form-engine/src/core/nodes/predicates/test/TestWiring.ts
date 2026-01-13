import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isTestPredicateNode } from '@form-engine/core/typeguards/predicate-nodes'
import { PredicateASTNode, TestPredicateASTNode } from '@form-engine/core/types/predicates.type'

/**
 * TestWiring: Wires TEST predicate expressions to their subject and condition
 *
 * Creates dependency edges for TEST nodes:
 * - TEST predicates have a subject and condition that must be evaluated
 *
 * Wiring pattern:
 * - SUBJECT → TEST_NODE (subject must be evaluated first)
 * - CONDITION → TEST_NODE (condition must be evaluated first)
 */
export default class TestWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  wire(): void {
    const logicNodes = this.wiringContext.nodeRegistry.findByType<PredicateASTNode>(ASTNodeType.PREDICATE)

    logicNodes.filter(isTestPredicateNode).forEach(testNode => {
      this.wireTest(testNode)
    })
  }

  wireNodes(nodeIds: NodeId[]): void {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isTestPredicateNode)
      .forEach(testNode => {
        this.wireTest(testNode)
      })
  }

  private wireTest(testNode: TestPredicateASTNode): void {
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
}
