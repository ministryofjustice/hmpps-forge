import { isAccessTransition, isLoadTransition, isSubmitTransition } from '@form-engine/form/typeguards/transitions'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { TransitionType } from '@form-engine/form/types/enums'
import {
  AccessTransitionASTNode,
  LoadTransitionASTNode,
  SubmitTransitionASTNode,
  TransitionASTNode,
} from '@form-engine/core/types/expressions.type'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import UnknownNodeTypeError from '@form-engine/errors/UnknownNodeTypeError'
import { NodeFactory } from '../NodeFactory'

/**
 * TransitionNodeFactory: Creates transition nodes (Load, Access, Submit)
 * Handles lifecycle event handlers for journeys and steps
 */
export class TransitionNodeFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
  ) {}

  /**
   * Transform Transition node: Lifecycle event handlers
   * Routes to specific transition type (Load, Access, Submit)
   */
  create(json: any): TransitionASTNode {
    if (isLoadTransition(json)) {
      return this.createLoadTransition(json)
    }

    if (isAccessTransition(json)) {
      return this.createAccessTransition(json)
    }

    if (isSubmitTransition(json)) {
      return this.createSubmitTransition(json)
    }

    throw new UnknownNodeTypeError({
      nodeType: json?.type,
      node: json,
      validTypes: ['LoadTransition', 'AccessTransition', 'SubmitTransition'],
    })
  }

  /**
   * Transform Load transition: Data loading on step/journey access
   * Executes effects before rendering
   */
  private createLoadTransition(json: any): LoadTransitionASTNode {
    const properties = new Map<string, ASTNode | any>()

    const effects = json.effects.map((effect: any) => this.nodeFactory.createNode(effect))

    properties.set('effects', effects)

    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
      type: ASTNodeType.TRANSITION,
      transitionType: TransitionType.LOAD,
      properties,
      raw: json,
    }
  }

  /**
   * Transform Access transition: Guards and analytics
   * Controls access and tracks user navigation
   */
  private createAccessTransition(json: any): AccessTransitionASTNode {
    const properties = new Map<string, ASTNode | any>()

    if (json.guards) {
      properties.set('guards', this.nodeFactory.createNode(json.guards))
    }

    if (Array.isArray(json.effects)) {
      const effects = json.effects.map((effect: any) => this.nodeFactory.createNode(effect))

      properties.set('effects', effects)
    }

    if (Array.isArray(json.redirect)) {
      const redirect = json.redirect.map((r: any) => this.nodeFactory.createNode(r))

      properties.set('redirect', redirect)
    }

    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
      type: ASTNodeType.TRANSITION,
      transitionType: TransitionType.ACCESS,
      properties,
      raw: json,
    }
  }

  /**
   * Transform Submit transition: Form submission handling
   * Manages validation, effects, and navigation on submit
   */
  private createSubmitTransition(json: any): SubmitTransitionASTNode {
    const properties = new Map<string, ASTNode | any>()

    if (json.when) {
      properties.set('when', this.nodeFactory.createNode(json.when))
    }

    if (json.guards) {
      properties.set('guards', this.nodeFactory.createNode(json.guards))
    }

    // Default to validation enabled unless explicitly false
    properties.set('validate', json.validate !== false)

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
      properties.set('onAlways', transformBranch(json.onAlways))
    }

    if (json.onValid) {
      properties.set('onValid', transformBranch(json.onValid))
    }

    if (json.onInvalid) {
      properties.set('onInvalid', transformBranch(json.onInvalid))
    }

    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
      type: ASTNodeType.TRANSITION,
      transitionType: TransitionType.SUBMIT,
      properties,
      raw: json,
    }
  }
}
