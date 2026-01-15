import { isAccessTransitionRedirect, isAccessTransitionError } from '@form-engine/form/typeguards/transitions'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { TransitionType } from '@form-engine/form/types/enums'
import { AccessTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { AccessTransition } from '@form-engine/form/types/expressions.type'

/**
 * AccessFactory: Creates Access transition nodes
 *
 * Handles access control, data loading, and analytics through:
 * - `when` conditions for conditional execution
 * - `effects` for data loading and side effects
 * - `redirect` for navigation on certain conditions
 * - `status`/`message` for error responses
 */
export default class AccessFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform Access transition definition into AST node
   */
  create(json: AccessTransition): AccessTransitionASTNode {
    const properties: AccessTransitionASTNode['properties'] = {}

    if (json.when) {
      properties.when = this.nodeFactory.createNode(json.when)
    }

    if (Array.isArray(json.effects)) {
      properties.effects = json.effects.map((effect: any) => this.nodeFactory.createNode(effect))
    }

    if (isAccessTransitionRedirect(json)) {
      properties.redirect = json.redirect.map((r: any) => this.nodeFactory.createNode(r))
    }

    if (isAccessTransitionError(json)) {
      properties.status = json.status
      properties.message = typeof json.message === 'string' ? json.message : this.nodeFactory.createNode(json.message)
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.TRANSITION,
      transitionType: TransitionType.ACCESS,
      properties,
      raw: json,
    }
  }
}
