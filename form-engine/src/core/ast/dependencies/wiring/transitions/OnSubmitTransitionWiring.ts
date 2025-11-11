import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { SubmitTransitionASTNode, TransitionASTNode, ExpressionASTNode } from '@form-engine/core/types/expressions.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType } from '@form-engine/form/types/enums'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { isSubmitTransitionNode } from '@form-engine/core/typeguards/transition-nodes'
import { NodeId } from '@form-engine/core/types/engine.type'

/**
 * OnSubmitTransitionWiring: Wires onSubmission transitions for all steps
 *
 * Creates dependency edges to ensure onSubmission transitions execute in the correct order.
 * Unlike onLoad, onSubmission only exists on Step nodes, not Journey nodes.
 *
 * Pattern: Transitions in the same array execute sequentially
 */
export default class OnSubmitTransitionWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all onSubmission transitions for all steps in the registry
   */
  wire() {
    this.wireOnSubmitTransitions()
  }

  private wireOnSubmitTransitions() {
    // Find all steps in the registry and wire their onSubmission transitions
    this.wiringContext.findNodesByType<TransitionASTNode>(ASTNodeType.TRANSITION)
      .filter(isSubmitTransitionNode)
      .forEach(submitTransitionNode => {
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
    const validate = transition.properties.get('validate')

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
    const when = transition.properties.get('when')

    if (when && typeof when === 'object' && 'id' in when) {
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
    const guards = transition.properties.get('guards')

    if (guards && typeof guards === 'object' && 'id' in guards) {
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
    const validate = transition.properties.get('validate')

    if (validate !== true) {
      return
    }

    // Find the parent Step of this submit transition
    const parentStep = this.findParentStep(transition.id)

    if (!parentStep) {
      return
    }

    // Find all validation expressions that are descendants of this specific step
    const validationNodes = this.wiringContext.findNodesByType<ExpressionASTNode>(ASTNodeType.EXPRESSION)
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
    const onAlways = transition.properties.get('onAlways')

    if (onAlways && typeof onAlways === 'object') {
      this.wireEffects(transition, onAlways.effects, 'onAlways')
    }

    // Wire onValid
    const onValid = transition.properties.get('onValid')

    if (onValid && typeof onValid === 'object') {
      this.wireEffects(transition, onValid.effects, 'onValid')
      this.wireNext(transition, onValid.next, 'onValid')
    }

    // Wire onInvalid
    const onInvalid = transition.properties.get('onInvalid')

    if (onInvalid && typeof onInvalid === 'object') {
      this.wireEffects(transition, onInvalid.effects, 'onInvalid')
      this.wireNext(transition, onInvalid.next, 'onInvalid')
    }
  }

  /**
   * Wire a skip validation transition (validate: false)
   * Wires onAlways branch
   */
  private wireSkipValidationTransition(transition: SubmitTransitionASTNode) {
    const onAlways = transition.properties.get('onAlways')

    if (onAlways && typeof onAlways === 'object') {
      this.wireEffects(transition, onAlways.effects, 'onAlways')
      this.wireNext(transition, onAlways.next, 'onAlways')
    }
  }

  /**
   * Wire effects array to the transition
   * Creates edges: effect → transition
   */
  private wireEffects(transition: SubmitTransitionASTNode, effects: any, branch: string) {
    if (!Array.isArray(effects)) {
      return
    }

    effects.forEach((effect, index) => {
      if (effect && typeof effect === 'object' && 'id' in effect) {
        this.wiringContext.graph.addEdge(effect.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: `${branch}.effects`,
          index,
        })
      }
    })
  }

  /**
   * Wire next expressions array to the transition
   * Creates edges: next → transition
   */
  private wireNext(transition: SubmitTransitionASTNode, next: any, branch: string) {
    if (!Array.isArray(next)) {
      return
    }

    next.forEach((nextExpr, index) => {
      if (nextExpr && typeof nextExpr === 'object' && 'id' in nextExpr) {
        this.wiringContext.graph.addEdge(nextExpr.id, transition.id, DependencyEdgeType.DATA_FLOW, {
          property: `${branch}.next`,
          index,
        })
      }
    })
  }
}
