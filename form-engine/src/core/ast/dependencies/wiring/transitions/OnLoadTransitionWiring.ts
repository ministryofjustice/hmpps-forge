import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { LoadTransitionASTNode, FunctionASTNode } from '@form-engine/core/types/expressions.type'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isLoadTransitionNode } from '@form-engine/core/typeguards/transition-nodes'

/**
 * OnLoadTransitionWiring: Wires onLoad transitions both within and across hierarchy levels
 *
 * Creates dependency edges to ensure onLoad transitions execute in the correct order:
 * - Same-depth: Transitions in the same array execute sequentially
 * - Cross-depth: Parent transitions complete before child transitions
 */
export default class OnLoadTransitionWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all onLoad transitions for the current step
   * Handles both same-depth and cross-depth wiring
   */
  wire() {
    this.wireSameDepthTransitions()
    this.wireCrossDepthTransitions()
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   * Filters to LoadTransitionASTNodes in nodeIds and wires their effects
   *
   * Note: Cross-depth and same-depth chaining is compile-time only
   * Runtime load transitions just need their effects wired
   */
  wireNodes(nodeIds: NodeId[]) {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isLoadTransitionNode)
      .forEach(loadTransition => {
        this.wiringContext.graph.addNode(loadTransition.id)
        this.wireTransitionEffects(loadTransition)
      })
  }

  /**
   * Wire transitions within the same parent node
   * Each Journey/Step's onLoad array gets chained: [0] → [1] → [2]
   */
  private wireSameDepthTransitions() {
    // Wire each ancestor Journey's array of on load transitions together
    const ancestorJourneys = this.wiringContext.findNodesByType<JourneyASTNode>(ASTNodeType.JOURNEY)
      .filter(journey => this.wiringContext.metadataRegistry.get(journey.id, 'isAncestorOfStep'))

    ancestorJourneys.forEach(journey => {
      const onLoadTransitions = journey.properties.onLoad
      this.wireTransitionsArray(onLoadTransitions)
    })

    // Wire the current step's array of on load transitions together
    const stepOnLoadTransitions = this.wiringContext.getCurrentStepNode().properties.onLoad as
      | LoadTransitionASTNode[]
      | undefined
    this.wireTransitionsArray(stepOnLoadTransitions)
  }

  /**
   * Wire transitions across hierarchy levels
   * Connects parent journey transitions to child journey/step transitions
   * Pattern: last transition of depth N → first transition of depth N+1
   */
  private wireCrossDepthTransitions() {
    // Get ancestor journeys
    const ancestorJourneys = this.wiringContext.findNodesByType<JourneyASTNode>(ASTNodeType.JOURNEY)
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
          chain: 'onLoad',
          crossDepth: true,
        })
      }
    })
  }

  /**
   * Chain an array of transitions in sequential order
   * Creates edges: transition[i] → transition[i+1]
   */
  private wireTransitionsArray(onLoadTransitions: LoadTransitionASTNode[]) {
    if (!onLoadTransitions || !Array.isArray(onLoadTransitions)) {
      return
    }

    onLoadTransitions.forEach((transition, index) => {
      this.wiringContext.graph.addNode(transition.id)

      // Wire the internal structure of this transition (effects and their arguments)
      this.wireTransitionEffects(transition)

      if (index + 1 < onLoadTransitions.length) {
        // Check if next element exists
        this.wiringContext.graph.addEdge(
          transition.id,
          onLoadTransitions.at(index + 1).id,
          DependencyEdgeType.CONTROL_FLOW,
          {
            chain: 'onLoad',
            crossDepth: false,
          },
        )
      }
    })
  }

  /**
   * Get the first onLoad transition from a node's properties
   * Returns undefined if no transitions exist
   */
  private getFirstTransition(node: JourneyASTNode | StepASTNode): LoadTransitionASTNode | undefined {
    const onLoad =
      node.type === ASTNodeType.STEP
        ? (node as StepASTNode).properties.onLoad
        : (node as JourneyASTNode).properties.onLoad

    return onLoad?.at(0)
  }

  /**
   * Get the last onLoad transition from a node's properties
   * Returns undefined if no transitions exist
   */
  private getLastTransition(node: JourneyASTNode | StepASTNode): LoadTransitionASTNode | undefined {
    const onLoad =
      node.type === ASTNodeType.STEP
        ? (node as StepASTNode).properties.onLoad
        : (node as JourneyASTNode).properties.onLoad

    return onLoad?.at(-1)
  }

  /**
   * Wire the effects within a transition to execute sequentially
   * Creates edges: effect[0] → effect[1] → effect[2] → transition
   *
   * Note: Effect arguments are wired by FunctionExpressionWiring since effects are FunctionASTNodes
   */
  private wireTransitionEffects(transition: LoadTransitionASTNode) {
    const effects = transition.properties.effects as FunctionASTNode[]

    if (!Array.isArray(effects) || effects.length === 0) {
      return
    }

    effects.forEach((effect, index) => {
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
}
