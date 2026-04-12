import { ASTNodeType } from '../../../types/enums'
import { HookType } from '../../../../authoring/types/enums'
import { ActionHookASTNode } from '../../../types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '../../../compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'
import { ActionHook } from '../../../../authoring/types/expressions.type'

/**
 * ActionFactory: Creates Action hook nodes
 * Handles button clicks that trigger effects without navigation (e.g., "Find address")
 */
export default class ActionFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform Action hook: In-page actions
   * Handles button clicks that trigger effects without navigation (e.g., "Find address")
   */
  create(json: ActionHook): ActionHookASTNode {
    const when = this.nodeFactory.createNode(json.when)
    const effects = json.effects.map((effect: any) => this.nodeFactory.createNode(effect))

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.HOOK,
      hookType: HookType.ACTION,
      properties: {
        when,
        effects,
      },
      raw: json,
    }
  }
}
