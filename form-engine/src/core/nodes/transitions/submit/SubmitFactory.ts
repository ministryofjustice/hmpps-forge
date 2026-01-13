import { ASTNodeType } from '@form-engine/core/types/enums'
import { TransitionType } from '@form-engine/form/types/enums'
import { SubmitTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { SubmitTransition } from '@form-engine/form/types/expressions.type'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'

/**
 * SubmitFactory: Creates Submit transition nodes
 * Handles form submission lifecycle including validation, effects, and navigation
 */
export default class SubmitFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform Submit transition: Form submission handling
   * Manages validation, effects, and navigation on submit
   */
  create(json: SubmitTransition): SubmitTransitionASTNode {
    const properties: SubmitTransitionASTNode['properties'] = {
      // Default to validation disabled unless explicitly true
      validate: json.validate === true,
    }

    if (json.when) {
      properties.when = this.nodeFactory.createNode(json.when)
    }

    if (json.guards) {
      properties.guards = this.nodeFactory.createNode(json.guards)
    }

    // Helper to transform submission branches (onAlways/onValid/onInvalid)
    const transformBranch = (branch: any) => {
      if (!branch) {
        return undefined
      }

      const result: any = {}

      if (Array.isArray(branch.effects)) {
        result.effects = branch.effects.map((effect: any) => this.nodeFactory.createNode(effect))
      }

      if (Array.isArray(branch.next)) {
        result.next = branch.next.map((n: any) => this.nodeFactory.createNode(n))
      }

      return result
    }

    if (json.onAlways) {
      properties.onAlways = transformBranch(json.onAlways)
    }

    if (json.onValid) {
      properties.onValid = transformBranch(json.onValid)
    }

    if (json.onInvalid) {
      properties.onInvalid = transformBranch(json.onInvalid)
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.TRANSITION,
      transitionType: TransitionType.SUBMIT,
      properties,
      raw: json,
    }
  }
}
