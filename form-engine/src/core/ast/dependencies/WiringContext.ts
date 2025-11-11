import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { PseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { ExpressionASTNode, LoadTransitionASTNode, ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import DependencyGraph from '@form-engine/core/ast/dependencies/DependencyGraph'
import { isJourneyStructNode, isStepStructNode } from '@form-engine/core/typeguards/structure-nodes'

/**
 * Implementation of WiringContext
 */
export class WiringContext {

  constructor(
    public readonly nodeRegistry: NodeRegistry,
    public readonly metadataRegistry: MetadataRegistry,
    public readonly graph: DependencyGraph,
  ) {}

  /**
   * Get the current step node (the step marked as isAncestorOfStep)
   */
  getStepNode(): StepASTNode {
    const step = this.nodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP)
      .find(node => this.metadataRegistry.get(node.id, 'isAncestorOfStep'))

    if (!step) {
      throw new Error('No current step found in node registry')
    }

    return step
  }

  findNodesByType<T extends ASTNode>(type: ASTNodeType): T[] {
    return this.nodeRegistry.findByType<T>(type)
  }

  findPseudoNodesByType<T extends PseudoNode>(type: PseudoNodeType): T[] {
    return Array.from(this.nodeRegistry.getAll().values()).filter(
      (node): node is T => 'type' in node && node.type === type,
    )
  }

  findPseudoNode<T extends PseudoNode>(type: PseudoNodeType, key: string): T | undefined {
    const allPseudoNodes = this.findPseudoNodesByType<T>(type)

    return allPseudoNodes.find(node => {
      const props = node.properties

      switch (type) {
        case PseudoNodeType.ANSWER_LOCAL:
        case PseudoNodeType.ANSWER_REMOTE:
        case PseudoNodeType.POST:
        case PseudoNodeType.DATA:
          return 'baseFieldCode' in props && props.baseFieldCode === key

        case PseudoNodeType.QUERY:
        case PseudoNodeType.PARAMS:
          return 'paramName' in props && props.paramName === key

        default:
          return false
      }
    })
  }

  findReferenceNodes(referenceSource: 'post' | 'query' | 'params' | 'data' | 'answers'): ReferenceASTNode[] {
    const allExprNodes = this.findNodesByType<ExpressionASTNode>(ASTNodeType.EXPRESSION)

    return (
      allExprNodes
        .filter(isReferenceExprNode)
        .filter(node => {
          const path = node.properties.get('path')

          return Array.isArray(path) && path.length >= 2 && path[0] === referenceSource
        })
    )
  }

  /**
   * Get the parent node ID from metadata registry
   * Returns undefined if no parent exists
   */
  getParentNodeId(nodeId: NodeId): NodeId | undefined {
    return this.metadataRegistry.get(nodeId, 'attachedToParentNode')
  }

  /**
   * Get the parent node from metadata registry
   * Returns undefined if no parent exists
   */
  getParentNode<T extends ASTNode = ASTNode>(nodeId: NodeId): T | undefined {
    const parentId = this.getParentNodeId(nodeId)

    return parentId ? (this.nodeRegistry.get(parentId) as T) : undefined
  }

  /**
   * Calculate the depth of a node in the tree
   * Root nodes have depth 0, their children have depth 1, etc.
   */
  getNodeDepth(nodeId: NodeId): number {
    let depth = 0
    let currentId: NodeId | undefined = nodeId

    while (currentId) {
      const parentId = this.getParentNodeId(currentId)

      if (!parentId) {
        break
      }

      depth += 1
      currentId = parentId
    }

    return depth
  }

  /**
   * Check if a node is an ancestor of the current step
   * Ancestors are parent journeys in the hierarchy leading to the step
   */
  isAncestorOfStep(nodeId: NodeId): boolean {
    return this.metadataRegistry.get(nodeId, 'isAncestorOfStep', false)
  }

  /**
   * Check if a node is a descendant of the current step
   * Descendants are child blocks and expressions within the step
   */
  isDescendantOfStep(nodeId: NodeId): boolean {
    return this.metadataRegistry.get(nodeId, 'isDescendantOfStep', false)
  }

  /**
   * Walk up the tree from a node to find the last onLoad transition
   * Searches from the node up through parent journeys, returning the last transition
   * from the first node (deepest-first) that has onLoad transitions
   */
  findLastOnLoadTransitionFrom(nodeId: NodeId): LoadTransitionASTNode | undefined {
    let currentNode = this.nodeRegistry.get(nodeId)

    while (currentNode) {
      if (isJourneyStructNode(currentNode) || isStepStructNode(currentNode)) {
        const onLoad = currentNode.properties.get('onLoad') as LoadTransitionASTNode[]

        if (Array.isArray(onLoad) && onLoad.length > 0) {
          return onLoad.at(-1)
        }
      }

      currentNode = this.getParentNode(currentNode.id)
    }

    // No onLoad transitions found in the entire ancestor chain
    return undefined
  }
}
