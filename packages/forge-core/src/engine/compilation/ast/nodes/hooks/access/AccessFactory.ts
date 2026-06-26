import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { HookType } from '../../../../../../authoring/types/enums'
import { AccessHookASTNode } from '../../../../../contracts/ast/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '../../../ast-state/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'
import { AccessHook } from '../../../../../../authoring/types/expressions.type'

/**
 * AccessFactory: Creates Access hook nodes
 *
 * Handles access control, data loading, and outcomes through:
 * - `when` conditions for conditional execution
 * - `effects` for data loading and side effects
 * - `next` outcomes for redirects and errors (first-match semantics)
 */
export default class AccessFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST,
  ) {}

  /**
   * Transform Access hook definition into AST node
   */
  create(json: AccessHook): AccessHookASTNode {
    const properties: AccessHookASTNode['properties'] = {}

    if (json.when) {
      properties.when = this.nodeFactory.createChildNode(json.when, 'when')
    }

    if (Array.isArray(json.effects)) {
      properties.effects = json.effects.map((effect: unknown, index) =>
        this.nodeFactory.createChildNode(effect, 'effects', index),
      )
    }

    if (Array.isArray(json.next)) {
      properties.next = json.next.map((outcome: unknown, index) =>
        this.nodeFactory.createChildNode(outcome, 'next', index),
      )
    }

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.HOOK,
      hookType: HookType.ACCESS,
      properties,
    }
  }
}
