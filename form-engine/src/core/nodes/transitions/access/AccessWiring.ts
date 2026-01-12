import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { AccessTransitionASTNode, TransitionASTNode } from '@form-engine/core/types/expressions.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { isAccessTransitionNode } from '@form-engine/core/typeguards/transition-nodes'
import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * AccessWiring: Wires onAccess transitions for steps and journey hierarchy
 *
 * Creates dependency edges to ensure onAccess transitions have their
 * dependencies (guards, effects, redirect, message) wired correctly.
 *
 * onAccess transitions run after onLoad at each hierarchy level and
 * evaluate guards to control access to the step.
 *
 * Pattern:
 * - guards predicate → transition (must evaluate before transition)
 * - effects → transition (effects are executed immediately)
 * - redirect expressions → transition (evaluated when guards match)
 * - message expression → transition (evaluated for error responses)
 */
export default class AccessWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all onAccess transitions found in the registry
   */
  wire() {
    this.wireOnAccessTransitions()
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   * Filters to AccessTransitionASTNodes in nodeIds and wires their properties
   */
  wireNodes(nodeIds: NodeId[]) {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isAccessTransitionNode)
      .forEach(accessTransition => {
        this.wiringContext.graph.addNode(accessTransition.id)
        this.wireTransitionProperties(accessTransition)
      })
  }

  private wireOnAccessTransitions() {
    const accessTransitions = this.wiringContext.nodeRegistry.findByType<TransitionASTNode>(ASTNodeType.TRANSITION)
      .filter(isAccessTransitionNode)

    accessTransitions.forEach(accessTransitionNode => {
      this.wiringContext.graph.addNode(accessTransitionNode.id)
      this.wireTransitionProperties(accessTransitionNode)
    })
  }

  private wireTransitionProperties(transition: AccessTransitionASTNode) {
    this.wireGuardsPredicate(transition)
    this.wireEffects(transition)
    this.wireRedirect(transition)
    this.wireMessage(transition)
  }

  /**
   * Wire the 'guards' predicate to the transition
   * Creates edge: guards → transition
   */
  private wireGuardsPredicate(transition: AccessTransitionASTNode) {
    const guards = transition.properties.guards

    if (isASTNode(guards)) {
      this.wiringContext.graph.addEdge(guards.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'guards',
      })
    }
  }

  /**
   * Wire effects array to the transition
   * Creates edges: effect → transition
   */
  private wireEffects(transition: AccessTransitionASTNode) {
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

  /**
   * Wire redirect expressions to the transition
   * Creates edges: redirect → transition
   */
  private wireRedirect(transition: AccessTransitionASTNode) {
    const redirect = transition.properties.redirect as ASTNode[] | undefined

    if (!redirect || !Array.isArray(redirect)) {
      return
    }

    redirect.filter(isASTNode).forEach((redirectExpr, index) => {
      this.wiringContext.graph.addEdge(redirectExpr.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'redirect',
        index,
      })
    })
  }

  /**
   * Wire message expression to the transition (for error responses)
   * Creates edge: message → transition
   */
  private wireMessage(transition: AccessTransitionASTNode) {
    const message = transition.properties.message

    if (isASTNode(message)) {
      this.wiringContext.graph.addEdge(message.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'message',
      })
    }
  }
}
