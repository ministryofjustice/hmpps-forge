import { ASTNodeType } from '../../../types/enums'
import { HookType } from '../../../../authoring/types/enums'
import { SubmitHookASTNode } from '../../../types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '../../../compilation/id-generators/NodeIDGenerator'
import { SubmitHook } from '../../../../authoring/types/expressions.type'
import { NodeFactory } from '../../NodeFactory'
import { ASTNode } from '../../../types/ast.type'

type SubmitBranch = NonNullable<SubmitHook['onAlways']>
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
    private readonly category: NodeIDCategory.COMPILE_AST,
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
      properties.when = this.nodeFactory.createNode(json.when)
    }

    if (json.guards) {
      properties.guards = this.nodeFactory.createNode(json.guards)
    }

    if (json.onAlways) {
      properties.onAlways = this.transformBranch(json.onAlways)
    }

    if (json.onValid) {
      properties.onValid = this.transformBranch(json.onValid)
    }

    if (json.onInvalid) {
      properties.onInvalid = this.transformBranch(json.onInvalid)
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.HOOK,
      hookType: HookType.SUBMIT,
      properties,
      raw: json,
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

  private transformBranch(branch: SubmitBranch): SubmitBranchAST {
    const result: SubmitBranchAST = {}

    if (Array.isArray(branch.effects)) {
      result.effects = branch.effects.map(effect => this.nodeFactory.createNode(effect))
    }

    if (Array.isArray(branch.next)) {
      result.next = branch.next.map(next => this.nodeFactory.createNode(next))
    }

    return result
  }
}
