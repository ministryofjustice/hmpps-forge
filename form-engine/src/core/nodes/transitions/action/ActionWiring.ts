import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import { ActionTransitionASTNode, TransitionASTNode } from '@form-engine/core/types/expressions.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { isActionTransitionNode } from '@form-engine/core/typeguards/transition-nodes'
import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * ActionWiring: Wires onAction transitions for steps
 *
 * Creates dependency edges to ensure onAction transitions have their
 * dependencies (when predicate, effects) wired correctly.
 *
 * onAction transitions are step-level only and execute on POST requests
 * before block evaluation, allowing effects to populate answers that
 * blocks will then display.
 *
 * Pattern:
 * - when predicate → transition (must evaluate before transition)
 * - effects → transition (effects are captured and committed)
 */
export default class ActionWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all onAction transitions found in the registry
   */
  wire() {
    this.wireOnActionTransitions()
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   * Filters to ActionTransitionASTNodes in nodeIds and wires their properties
   */
  wireNodes(nodeIds: NodeId[]) {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isActionTransitionNode)
      .forEach(actionTransition => {
        this.wiringContext.graph.addNode(actionTransition.id)
        this.wireTransitionProperties(actionTransition)
      })
  }

  private wireOnActionTransitions() {
    const actionTransitions = this.wiringContext.nodeRegistry.findByType<TransitionASTNode>(ASTNodeType.TRANSITION)
      .filter(isActionTransitionNode)

    actionTransitions.forEach(actionTransitionNode => {
      this.wiringContext.graph.addNode(actionTransitionNode.id)
      this.wireTransitionProperties(actionTransitionNode)
    })
  }

  private wireTransitionProperties(transition: ActionTransitionASTNode) {
    this.wireWhenPredicate(transition)
    this.wireEffects(transition)
  }

  /**
   * Wire the 'when' predicate to the transition
   * Creates edge: when → transition
   */
  private wireWhenPredicate(transition: ActionTransitionASTNode) {
    const when = transition.properties.when

    if (isASTNode(when)) {
      this.wiringContext.graph.addEdge(when.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
    }
  }

  /**
   * Wire effects array to the transition
   * Creates edges: effect → transition
   */
  private wireEffects(transition: ActionTransitionASTNode) {
    const effects = transition.properties.effects as ASTNode[] | undefined

    if (!effects || !Array.isArray(effects)) {
      return
    }

    effects.filter(isASTNode).forEach((effect, index) => {
      this.wiringContext.graph.addEdge(effect.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'effects',
        index,
      })
    })
  }
}
