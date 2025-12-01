import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { CollectionASTNode, ExpressionASTNode } from '@form-engine/core/types/expressions.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isCollectionExprNode } from '@form-engine/core/typeguards/expression-nodes'

/**
 * CollectionExpressionWiring: Wires collection expressions to their dependencies
 *
 * Creates dependency edges for collection expansion nodes:
 * - Collections have a source collection expression and optional fallback array
 * - The collection and fallback items must be evaluated before expansion
 *
 * Wiring pattern for COLLECTION:
 * - COLLECTION → COLLECTION_NODE (collection must be evaluated first)
 * - FALLBACK[i] → COLLECTION_NODE (each fallback item must be evaluated)
 */
export default class CollectionExpressionWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all collection expressions to their collection and fallback nodes
   */
  wire() {
    const expressionNodes = this.wiringContext.findNodesByType<ExpressionASTNode>(ASTNodeType.EXPRESSION)

    expressionNodes
      .filter(isCollectionExprNode)
      .forEach(collectionNode => {
        this.wireCollection(collectionNode)
      })
  }

  /**
   * Wire a collection expression to its collection source and fallback dependencies
   *
   * Creates edges: collection → collectionNode, fallback[i] → collectionNode
   */
  private wireCollection(collectionNode: CollectionASTNode) {
    const collection = collectionNode.properties.collection
    const fallback = collectionNode.properties.fallback

    // Wire collection → collectionNode (collection must be evaluated before expansion)
    if (isASTNode(collection)) {
      this.wiringContext.graph.addEdge(collection.id, collectionNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'collection',
      })
    }

    // Wire fallback items → collectionNode
    if (Array.isArray(fallback)) {
      fallback.forEach((item, index) => {
        if (isASTNode(item)) {
          this.wiringContext.graph.addEdge(item.id, collectionNode.id, DependencyEdgeType.DATA_FLOW, {
            property: 'fallback',
            index,
          })
        }
      })
    }
  }
}
