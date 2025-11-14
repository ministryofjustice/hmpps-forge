import { isAccessTransition, isLoadTransition, isSubmitTransition } from '@form-engine/form/typeguards/transitions'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { TransitionType } from '@form-engine/form/types/enums'
import {
  AccessTransitionASTNode,
  LoadTransitionASTNode,
  SubmitTransitionASTNode,
} from '@form-engine/core/types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import UnknownNodeTypeError from '@form-engine/errors/UnknownNodeTypeError'
import { AccessTransition, LoadTransition, SubmitTransition } from '@form-engine/form/types/expressions.type'
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
  create(json: any): LoadTransitionASTNode | AccessTransitionASTNode | SubmitTransitionASTNode {
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
  private createLoadTransition(json: LoadTransition): LoadTransitionASTNode {
    const effects = json.effects.map((effect: any) => this.nodeFactory.createNode(effect))

    return {
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
      type: ASTNodeType.TRANSITION,
      transitionType: TransitionType.LOAD,
      properties: {
        effects,
      },
      raw: json,
    }
  }

  /**
   * Transform Access transition: Guards and analytics
   * Controls access and tracks user navigation
   */
  private createAccessTransition(json: AccessTransition): AccessTransitionASTNode {
    const properties: AccessTransitionASTNode['properties'] = {}

    if (json.guards) {
      properties.guards = this.nodeFactory.createNode(json.guards)
    }

    if (Array.isArray(json.effects)) {
      properties.effects = json.effects.map((effect: any) => this.nodeFactory.createNode(effect))
    }

    if (Array.isArray(json.redirect)) {
      properties.redirect = json.redirect.map((r: any) => this.nodeFactory.createNode(r))
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
  private createSubmitTransition(json: SubmitTransition): SubmitTransitionASTNode {
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
      id: this.nodeIDGenerator.next(NodeIDCategory.COMPILE_AST),
      type: ASTNodeType.TRANSITION,
      transitionType: TransitionType.SUBMIT,
      properties,
      raw: json,
    }
  }
}
