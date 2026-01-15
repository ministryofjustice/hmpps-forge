import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { AccessTransitionASTNode, FunctionASTNode } from '@form-engine/core/types/expressions.type'
import { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { isAccessTransitionNode } from '@form-engine/core/typeguards/transition-nodes'
import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * AccessWiring: Wires onAccess transitions both within and across hierarchy levels
 *
 * Creates dependency edges to ensure onAccess transitions execute in the correct order:
 * - Same-depth: Transitions in the same array execute sequentially
 * - Cross-depth: Parent transitions complete before child transitions
 *
 * Also wires internal transition dependencies:
 * - `when` predicate → transition (must evaluate before transition)
 * - effects → transition (executed sequentially when transition runs)
 * - redirect expressions → transition (evaluated to determine navigation)
 * - message expression → transition (evaluated for error responses)
 */
export default class AccessWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all onAccess transitions for the current step
   * Handles same-depth chaining, cross-depth chaining, and internal dependencies
   */
  wire() {
    this.wireSameDepthTransitions()
    this.wireCrossDepthTransitions()
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   * Filters to AccessTransitionASTNodes in nodeIds and wires their internal dependencies
   *
   * Note: Cross-depth and same-depth chaining is compile-time only
   * Runtime access transitions just need their internal dependencies wired
   */
  wireNodes(nodeIds: NodeId[]) {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isAccessTransitionNode)
      .forEach(accessTransition => {
        this.wiringContext.graph.addNode(accessTransition.id)
        this.wireTransitionInternalDependencies(accessTransition)
      })
  }

  /**
   * Wire transitions within the same parent node
   * Each Journey/Step's onAccess array gets chained: [0] → [1] → [2]
   */
  private wireSameDepthTransitions() {
    // Wire each ancestor Journey's array of onAccess transitions together
    const ancestorJourneys = this.wiringContext.nodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY)
      .filter(journey => this.wiringContext.metadataRegistry.get(journey.id, 'isAncestorOfStep'))

    ancestorJourneys.forEach(journey => {
      const onAccessTransitions = journey.properties.onAccess
      this.wireTransitionsArray(onAccessTransitions)
    })

    // Wire the current step's array of onAccess transitions together
    const stepOnAccessTransitions = this.wiringContext.getCurrentStepNode().properties.onAccess as
      | AccessTransitionASTNode[]
      | undefined
    this.wireTransitionsArray(stepOnAccessTransitions)
  }

  /**
   * Wire transitions across hierarchy levels
   * Connects parent journey transitions to child journey/step transitions
   * Pattern: last transition of depth N → first transition of depth N+1
   */
  private wireCrossDepthTransitions() {
    // Get ancestor journeys
    const ancestorJourneys = this.wiringContext.nodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY)
      .filter(journey => this.wiringContext.metadataRegistry.get(journey.id, 'isAncestorOfStep'))

    // Add their depth information
    const ancestorJourneysWithDepth = ancestorJourneys
      .map(journey => ({ journey, depth: this.wiringContext.getNodeDepth(journey.id) }))
      .sort((a, b) => a.depth - b.depth)

    // Wire cross-depth: last of each level → first of next level
    ancestorJourneysWithDepth.forEach(({ journey }, index) => {
      const lastTransition = this.getLastTransition(journey)

      if (!lastTransition) {
        return
      }

      // Determine next level (either next journey or the step)
      const nextNode =
        index + 1 < ancestorJourneysWithDepth.length
          ? ancestorJourneysWithDepth.at(index + 1).journey
          : this.wiringContext.getCurrentStepNode()

      const firstTransition = this.getFirstTransition(nextNode)

      if (firstTransition) {
        this.wiringContext.graph.addEdge(lastTransition.id, firstTransition.id, DependencyEdgeType.CONTROL_FLOW, {
          chain: 'onAccess',
          crossDepth: true,
        })
      }
    })
  }

  /**
   * Chain an array of transitions in sequential order
   * Creates edges: transition[i] → transition[i+1]
   */
  private wireTransitionsArray(onAccessTransitions: AccessTransitionASTNode[] | undefined) {
    if (!onAccessTransitions || !Array.isArray(onAccessTransitions)) {
      return
    }

    onAccessTransitions.forEach((transition, index) => {
      this.wiringContext.graph.addNode(transition.id)

      // Wire the internal dependencies of this transition
      this.wireTransitionInternalDependencies(transition)

      if (index + 1 < onAccessTransitions.length) {
        // Chain to next transition
        this.wiringContext.graph.addEdge(
          transition.id,
          onAccessTransitions.at(index + 1).id,
          DependencyEdgeType.CONTROL_FLOW,
          {
            chain: 'onAccess',
            crossDepth: false,
          },
        )
      }
    })
  }

  /**
   * Get the first onAccess transition from a node's properties
   * Returns undefined if no transitions exist
   */
  private getFirstTransition(node: JourneyASTNode | StepASTNode): AccessTransitionASTNode | undefined {
    const onAccess =
      node.type === ASTNodeType.STEP
        ? (node as StepASTNode).properties.onAccess
        : (node as JourneyASTNode).properties.onAccess

    return onAccess?.at(0)
  }

  /**
   * Get the last onAccess transition from a node's properties
   * Returns undefined if no transitions exist
   */
  private getLastTransition(node: JourneyASTNode | StepASTNode): AccessTransitionASTNode | undefined {
    const onAccess =
      node.type === ASTNodeType.STEP
        ? (node as StepASTNode).properties.onAccess
        : (node as JourneyASTNode).properties.onAccess

    return onAccess?.at(-1)
  }

  /**
   * Wire all internal dependencies of a transition
   */
  private wireTransitionInternalDependencies(transition: AccessTransitionASTNode) {
    this.wireWhenCondition(transition)
    this.wireEffects(transition)
    this.wireRedirect(transition)
    this.wireMessage(transition)
  }

  /**
   * Wire the 'when' condition to the transition
   * Creates edge: when → transition
   */
  private wireWhenCondition(transition: AccessTransitionASTNode) {
    const when = transition.properties.when

    if (isASTNode(when)) {
      this.wiringContext.graph.addEdge(when.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
    }
  }

  /**
   * Wire effects array to execute sequentially
   * Creates edges: effect[0] → effect[1] → effect[2] → transition
   */
  private wireEffects(transition: AccessTransitionASTNode) {
    const effects = transition.properties.effects as FunctionASTNode[] | undefined

    if (!effects || !Array.isArray(effects) || effects.length === 0) {
      return
    }

    effects.filter(isASTNode).forEach((effect, index) => {
      if (index + 1 < effects.length) {
        // Chain to next effect
        this.wiringContext.graph.addEdge(effect.id, effects[index + 1].id, DependencyEdgeType.CONTROL_FLOW, {
          chain: 'effects',
        })
      } else {
        // Last effect wires to transition
        this.wiringContext.graph.addEdge(effect.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: 'effects',
        })
      }
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
