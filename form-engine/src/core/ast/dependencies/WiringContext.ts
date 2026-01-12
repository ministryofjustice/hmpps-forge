import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { ExpressionType } from '@form-engine/form/types/enums'
import { LoadTransitionASTNode, ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import DependencyGraph from '@form-engine/core/ast/dependencies/DependencyGraph'
import { isJourneyStructNode, isStepStructNode } from '@form-engine/core/typeguards/structure-nodes'
import getAncestorChain from '@form-engine/core/ast/utils/getAncestorChain'

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
   * Get the current step node (the step marked as isCurrentStep)
   */
  getCurrentStepNode(): StepASTNode {
    const stepId = this.metadataRegistry.findNodesWhere('isCurrentStep', true).at(0)

    if (!stepId) {
      throw new Error('No current step found in metadata registry')
    }

    return this.nodeRegistry.get(stepId) as StepASTNode
  }

  findReferenceNodes(referenceSource: 'post' | 'query' | 'params' | 'data' | 'answers'): ReferenceASTNode[] {
    return (
      this.nodeRegistry.findByType<ReferenceASTNode>(ExpressionType.REFERENCE)
        .filter(node => {
          const path = node.properties.path

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
    return getAncestorChain(nodeId, this.metadataRegistry).length - 1
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
    // Reverse to search deepest-first, find first ancestor with onLoad transitions
    const ancestorWithOnLoad = getAncestorChain(nodeId, this.metadataRegistry)
      .reverse()
      .map(ancestorId => this.nodeRegistry.get(ancestorId))
      .filter(node => isStepStructNode(node) || isJourneyStructNode(node))
      .find(node => {
        const onLoad = node.properties.onLoad
        return Array.isArray(onLoad) && onLoad.length > 0
      })

    if (!ancestorWithOnLoad) {
      return undefined
    }

    return ancestorWithOnLoad.properties.onLoad.at(-1)
  }
}
