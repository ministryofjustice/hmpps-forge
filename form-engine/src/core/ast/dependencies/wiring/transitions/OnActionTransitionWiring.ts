import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { ActionTransitionASTNode, TransitionASTNode } from '@form-engine/core/types/expressions.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { isActionTransitionNode } from '@form-engine/core/typeguards/transition-nodes'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * OnActionTransitionWiring: Wires onAction transitions for steps
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
export default class OnActionTransitionWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all onAction transitions found in the registry
   */
  wire() {
    this.wireOnActionTransitions()
  }

  private wireOnActionTransitions() {
    const actionTransitions = this.wiringContext.findNodesByType<TransitionASTNode>(ASTNodeType.TRANSITION)
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
