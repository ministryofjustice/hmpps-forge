import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionASTNode, SubmitTransitionASTNode, ValidationASTNode } from '@form-engine/core/types/expressions.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
import { NodeId } from '@form-engine/core/types/engine.type'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { isValidationExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { isSubmitTransitionNode } from '@form-engine/core/typeguards/transition-nodes'

/**
 * ValidationWiring: Wires validation expressions to their conditions
 *
 * Creates dependency edges for validation nodes:
 * - Validations have a condition that must be evaluated before the validation result is known
 *
 * Wiring pattern for VALIDATION:
 * - CONDITION → VALIDATION (condition must be evaluated first)
 * - VALIDATION → SUBMIT_TRANSITION (PUSH: validation must be evaluated before submit transition)
 */
export default class ValidationWiring {
  constructor(private readonly wiringContext: WiringContext) {}

  /**
   * Wire all validation expressions to their condition nodes
   */
  wire() {
    const expressionNodes = this.wiringContext.nodeRegistry.findByType<ExpressionASTNode>(ASTNodeType.EXPRESSION)

    expressionNodes
      .filter(isValidationExprNode)
      .forEach(validationNode => {
        this.wireValidation(validationNode)
      })
  }

  /**
   * Wire only the specified nodes (scoped wiring for runtime nodes)
   * Includes PUSH logic to wire new validations to existing submit transitions
   */
  wireNodes(nodeIds: NodeId[]) {
    nodeIds
      .map(id => this.wiringContext.nodeRegistry.get(id))
      .filter(isValidationExprNode)
      .forEach(validationNode => {
        // PULL: condition → validation
        this.wireValidation(validationNode)

        // PUSH: validation → submit transitions
        this.wireToConsumingTransitions(validationNode)
      })
  }

  /**
   * Wire a validation expression to its condition
   *
   * Creates edge: condition → validation
   */
  private wireValidation(validationNode: ValidationASTNode) {
    const condition = validationNode.properties.when

    // Wire condition → validation (condition must be evaluated before validation)
    if (isASTNode(condition)) {
      this.wiringContext.graph.addEdge(condition.id, validationNode.id, DependencyEdgeType.DATA_FLOW, {
        property: 'when',
      })
    }
  }

  /**
   * PUSH: Wire validation to submit transitions that consume it
   * Walks up to find parent step, then finds its submit transitions with validate: true
   */
  private wireToConsumingTransitions(validationNode: ValidationASTNode) {
    const parentStep = this.findParentStep(validationNode.id)

    if (!parentStep) {
      return
    }

    // Find submit transitions in this step with validate: true
    const submitTransitions = this.findValidatingSubmitTransitions(parentStep)

    // Wire validation → transition (validation must be evaluated before transition)
    submitTransitions.forEach(transition => {
      this.wiringContext.graph.addEdge(validationNode.id, transition.id, DependencyEdgeType.DATA_FLOW, {
        property: 'validations',
      })
    })
  }

  /**
   * Find the parent Step node by walking up the tree
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
   * Find submit transitions in a step that have validate: true
   */
  private findValidatingSubmitTransitions(step: StepASTNode): SubmitTransitionASTNode[] {
    const onSubmission = step.properties.onSubmission

    if (!Array.isArray(onSubmission)) {
      return []
    }

    return onSubmission
      .filter(isSubmitTransitionNode)
      .filter(transition => transition.properties.validate === true)
  }
}
