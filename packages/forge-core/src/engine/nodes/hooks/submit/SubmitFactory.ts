import { ASTNodeType } from '../../../types/enums'
import { HookType } from '../../../../authoring/types/enums'
import { SubmitHookASTNode } from '../../../types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '../../../compilation/id-generators/NodeIDGenerator'
import { SubmitHook } from '../../../../authoring/types/expressions.type'
import { NodeFactory } from '../../NodeFactory'

/**
 * SubmitFactory: Creates Submit hook nodes
 * Handles form submission lifecycle including validation, effects, and navigation
 */
export default class SubmitFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform Submit hook: Form submission handling
   * Manages validation, effects, and navigation on submit
   */
  create(json: SubmitHook): SubmitHookASTNode {
    const properties: SubmitHookASTNode['properties'] = {
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
      type: ASTNodeType.HOOK,
      hookType: HookType.SUBMIT,
      properties,
      raw: json,
    }
  }
}
