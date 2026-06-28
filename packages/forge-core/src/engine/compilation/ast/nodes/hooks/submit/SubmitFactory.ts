import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { HookType } from '../../../../../../authoring/types/enums'
import { SubmitHookASTNode } from '../../../../../contracts/ast/expressions.type'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import { SubmitHook } from '../../../../../../authoring/types/expressions.type'
import { NodeFactory } from '../../NodeFactory'
import type { ASTNode } from '../../../../../contracts/ast/ast.type'

type SubmitBranch = NonNullable<SubmitHook['onAlways']>
type SubmitBranchName = 'onAlways' | 'onValid' | 'onInvalid'
type SubmitBranchAST = {
  effects?: ASTNode[]
  next?: ASTNode[]
}

/**
 * SubmitFactory: Creates Submit hook nodes
 * Handles form submission lifecycle including validation, effects, and navigation
 */
export default class SubmitFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
  ) {}

  /**
   * Transform Submit hook: Form submission handling
   * Manages validation, effects, and navigation on submit
   */
  create(json: SubmitHook): SubmitHookASTNode {
    const properties: SubmitHookASTNode['properties'] = {
      validate: json.validate !== undefined && json.validate !== false,
      validationGroups: this.getValidationGroups(json.validate),
    }

    if (json.when) {
      properties.when = this.nodeFactory.createChildNode(json.when, 'when')
    }

    if (json.guards) {
      properties.guards = this.nodeFactory.createChildNode(json.guards, 'guards')
    }

    if (json.onAlways) {
      properties.onAlways = this.transformBranch(json.onAlways, 'onAlways')
    }

    if (json.onValid) {
      properties.onValid = this.transformBranch(json.onValid, 'onValid')
    }

    if (json.onInvalid) {
      properties.onInvalid = this.transformBranch(json.onInvalid, 'onInvalid')
    }

    return {
      id: this.nodeIDGenerator.nextAstNodeId(),
      type: ASTNodeType.HOOK,
      hookType: HookType.SUBMIT,
      properties,
    }
  }

  private getValidationGroups(validate: SubmitHook['validate']): string[] {
    if (validate === true) {
      return ['default']
    }

    if (validate === false || validate === undefined) {
      return []
    }

    return validate.groups
  }

  private transformBranch(branch: SubmitBranch, branchName: SubmitBranchName): SubmitBranchAST {
    const result: SubmitBranchAST = {}

    if (Array.isArray(branch.effects)) {
      result.effects = branch.effects.map((effect, index) =>
        this.nodeFactory.createChildNode(effect, branchName, 'effects', index),
      )
    }

    if (Array.isArray(branch.next)) {
      result.next = branch.next.map((next, index) => this.nodeFactory.createChildNode(next, branchName, 'next', index))
    }

    return result
  }
}
