import { isAccessTransitionRedirect, isAccessTransitionError } from '@form-engine/form/typeguards/transitions'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { TransitionType } from '@form-engine/form/types/enums'
import { AccessTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import { AccessTransition } from '@form-engine/form/types/expressions.type'

/**
 * AccessFactory: Creates Access transition nodes
 * Handles guards, analytics, redirects, and error responses
 * Controls access and tracks user navigation
 */
export default class AccessFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform Access transition: Guards and analytics
   * Controls access and tracks user navigation
   * Handles both redirect-based and error response-based access transitions.
   */
  create(json: AccessTransition): AccessTransitionASTNode {
    const properties: AccessTransitionASTNode['properties'] = {}

    if (json.guards) {
      properties.guards = this.nodeFactory.createNode(json.guards)
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
