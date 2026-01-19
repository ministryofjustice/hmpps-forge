import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import { SubmitTransitionASTNode, TransitionASTNode, ExpressionASTNode } from '@form-engine/core/types/expressions.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType } from '@form-engine/form/types/enums'
import { DependencyEdgeType } from '@form-engine/core/compilation/dependency-graph/DependencyGraph'
import { isSubmitTransitionNode, isTransitionNode } from '@form-engine/core/typeguards/transition-nodes'
import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'

/**
 * SubmitWiring: Wires onSubmission transitions for all steps
 *
 * Creates dependency edges to ensure onSubmission transitions execute in the correct order.
 * Unlike onLoad, onSubmission only exists on Step nodes, not Journey nodes.
 *
 * Pattern: Transitions in the same array execute sequentially
 */
export default class SubmitWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all onSubmission transitions for all steps in the registry
   */
  wire() {
    this.wireOnSubmitTransitions()
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   * Filters to SubmitTransitionASTNodes in nodeIds and wires their properties
   */
  wireNodes(nodeIds: NodeId[]) {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isTransitionNode)
      .filter(isSubmitTransitionNode)
      .forEach(submitTransition => {
        this.wiringContext.graph.addNode(submitTransition.id)
        this.wireTransitionProperties(submitTransition)
      })
  }

  private wireOnSubmitTransitions() {
    // Find all steps in the registry and wire their onSubmission transitions
    const submitTransitions = this.wiringContext.nodeRegistry.findByType<TransitionASTNode>(ASTNodeType.TRANSITION)
      .filter(isSubmitTransitionNode)

    submitTransitions.forEach(submitTransitionNode => {
      this.wiringContext.graph.addNode(submitTransitionNode.id)
      this.wireTransitionProperties(submitTransitionNode)
    })
  }

  private wireTransitionProperties(transition: SubmitTransitionASTNode) {
    // Wire common properties
    this.wireWhenPredicate(transition)
    this.wireGuardsPredicate(transition)

    // Wire validation-specific dependencies
    this.wireValidationDependencies(transition)

    // Determine which transition type we have
    const validate = transition.properties.validate

    if (validate === true) {
      // ValidatingTransition
      this.wireValidatingTransition(transition)
    } else if (validate === false) {
      // SkipValidationTransition
      this.wireSkipValidationTransition(transition)
    }
  }

  /**
   * Wire the 'when' predicate if it exists
   * Creates edge: when → transition
   */
  private wireWhenPredicate(transition: SubmitTransitionASTNode) {
    const when = transition.properties.when

    if (isASTNode(when)) {
      this.wiringContext.graph.addEdge(when.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
    }
  }

  /**
   * Wire the 'guards' predicate if it exists
   * Creates edge: guards → transition
   */
  private wireGuardsPredicate(transition: SubmitTransitionASTNode) {
    const guards = transition.properties.guards

    if (isASTNode(guards)) {
      this.wiringContext.graph.addEdge(guards.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'guards',
      })
    }
  }

  /**
   * Wire validation expressions to this transition if validate is true
   * Ensures all validations in the step are evaluated before the transition executes
   */
  private wireValidationDependencies(transition: SubmitTransitionASTNode) {
    const validate = transition.properties.validate

    if (validate !== true) {
      return
    }

    // Find the parent Step of this submit transition
    const parentStep = this.findParentStep(transition.id)

    if (!parentStep) {
      return
    }

    // Find all validation expressions that are descendants of this specific step
    const validationNodes = this.wiringContext.nodeRegistry.findByType<ExpressionASTNode>(ASTNodeType.EXPRESSION)
      .filter(node => node.expressionType === ExpressionType.VALIDATION)
      .filter(node => this.isDescendantOf(node.id, parentStep.id))

    // Wire each validation → transition (validations must be evaluated first)
    validationNodes.forEach(validationNode => {
      this.wiringContext.graph.addEdge(validationNode.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'validations',
      })
    })
  }

  /**
   * Find the parent Step node of a given node
   * Walks up the tree until a Step node is found
   */
  private findParentStep(nodeId: NodeId): StepASTNode | undefined {
    let currentNode = this.wiringContext.nodeRegistry.get(nodeId)

    while (currentNode) {
      if (currentNode.type === ASTNodeType.STEP) {
        return currentNode as StepASTNode
      }

      currentNode = this.wiringContext.getParentNode(currentNode.id)
    }

    return undefined
  }

  /**
   * Check if a node is a descendant of another node
   * Walks up from the potential descendant to see if we reach the ancestor
   */
  private isDescendantOf(descendantId: NodeId, ancestorId: NodeId): boolean {
    let currentNode = this.wiringContext.nodeRegistry.get(descendantId)

    while (currentNode) {
      const parentNode = this.wiringContext.getParentNode(currentNode.id)

      if (!parentNode) {
        return false
      }

      if (parentNode.id === ancestorId) {
        return true
      }

      currentNode = parentNode
    }

    return false
  }

  /**
   * Wire a validating transition (validate: true)
   * Wires onAlways, onValid, and onInvalid branches
   */
  private wireValidatingTransition(transition: SubmitTransitionASTNode) {
    // Wire onAlways (if present)
    const onAlways = transition.properties.onAlways

    if (onAlways) {
      this.wireEffects(transition, onAlways.effects, 'onAlways')
    }

    // Wire onValid
    const onValid = transition.properties.onValid

    if (onValid) {
      this.wireEffects(transition, onValid.effects, 'onValid')
      this.wireNext(transition, onValid.next, 'onValid')
    }

    // Wire onInvalid
    const onInvalid = transition.properties.onInvalid

    if (onInvalid) {
      this.wireEffects(transition, onInvalid.effects, 'onInvalid')
      this.wireNext(transition, onInvalid.next, 'onInvalid')
    }
  }

  /**
   * Wire a skip validation transition (validate: false)
   * Wires onAlways branch
   */
  private wireSkipValidationTransition(transition: SubmitTransitionASTNode) {
    const onAlways = transition.properties.onAlways

    if (onAlways) {
      this.wireEffects(transition, onAlways.effects, 'onAlways')
      this.wireNext(transition, onAlways.next, 'onAlways')
    }
  }

  /**
   * Wire effects array to the transition
   * Creates edges: effect → transition
   */
  private wireEffects(transition: SubmitTransitionASTNode, effects: ASTNode[] | undefined, branch: string) {
    if (!effects) {
      return
    }

    effects.filter(isASTNode).forEach((effect, index) => {
      this.wiringContext.graph.addEdge(effect.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: `${branch}.effects`,
        index,
      })
    })
  }

  /**
   * Wire next outcomes array to the transition
   * Creates edges: outcome → transition
   * Note: Outcome internal dependencies are wired by RedirectOutcomeWiring/ThrowErrorOutcomeWiring
   */
  private wireNext(transition: SubmitTransitionASTNode, next: ASTNode[] | undefined, branch: string) {
    if (!next) {
      return
    }

    next.filter(isASTNode).forEach((outcome, index) => {
      this.wiringContext.graph.addEdge(outcome.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: `${branch}.next`,
        index,
      })
    })
  }
}
