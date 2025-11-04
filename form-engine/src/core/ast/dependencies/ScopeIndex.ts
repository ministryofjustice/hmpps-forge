import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isJourneyStructNode, isStepStructNode, isBlockStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { isLoadTransitionNode } from '@form-engine/core/typeguards/transition-nodes'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'

/**
 * A single entry in the scope chain representing a structural node
 */
export interface ScopeEntry {
  id: NodeId
  nodeType: ASTNodeType
}

/**
 * Scope information for a node
 * Represents the complete hierarchy from outermost to innermost structural nodes
 */
export interface ScopeInfo {
  scopeChain: ScopeEntry[] // Complete hierarchy from outermost to innermost (journeys, step, blocks)
  onLoadChain: NodeId[] // IDs of onLoad transitions in scope (from all journeys and step)
}

/**
 * Computes scope information by walking up the parent chain
 * Used to determine which onLoad transitions are in scope for Answer/Data wiring
 *
 * TODO just gonna say, I do think this approach sux, but I'm not sure of a better alternative.
 */
export default class ScopeIndex {
  constructor(private readonly nodeRegistry: NodeRegistry) {}

  /**
   * Get scope information for a node by walking up the parent chain
   */
  getScope(nodeId: NodeId): ScopeInfo | undefined {
    const node = this.nodeRegistry.get(nodeId)

    // Pseudo nodes don't have parent pointers or scope
    if (!isASTNode(node)) {
      return undefined
    }

    let current = node
    const scopeChain: ScopeEntry[] = []
    const onLoadChain: NodeId[] = []

    while (current) {
      if (isBlockStructNode(current)) {
        scopeChain.unshift({
          id: current.id,
          nodeType: current.type,
        })
      }

      if (isStepStructNode(current)) {
        scopeChain.unshift({
          id: current.id,
          nodeType: current.type,
        })

        const stepOnLoad = this.extractOnLoadTransitions(current)

        onLoadChain.unshift(...stepOnLoad)
      }

      if (isJourneyStructNode(current)) {
        scopeChain.unshift({
          id: current.id,
          nodeType: current.type,
        })

        const journeyOnLoad = this.extractOnLoadTransitions(current)

        onLoadChain.unshift(...journeyOnLoad)
      }

      current = current.parentNode
    }

    return {
      scopeChain,
      onLoadChain,
    }
  }

  /**
   * Get all onLoad transitions for a given scope context
   */
  getOnLoadChain(nodeId: NodeId): NodeId[] {
    return this.getScope(nodeId)?.onLoadChain ?? []
  }

  /**
   * Extract onLoad transition IDs from a node's properties
   */
  private extractOnLoadTransitions(node: StepASTNode | JourneyASTNode): NodeId[] {
    const onLoad = node.properties.get('onLoad')

    if (!Array.isArray(onLoad)) {
      return []
    }

    const transitionIds: NodeId[] = []

    onLoad.forEach(transition => {
      if (isLoadTransitionNode(transition)) {
        transitionIds.push(transition.id)
      }
    })

    return transitionIds
  }
}
