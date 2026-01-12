import { ASTNodeType } from '@form-engine/core/types/enums'
import { TransitionType } from '@form-engine/form/types/enums'
import { ActionTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import { ActionTransition } from '@form-engine/form/types/expressions.type'

/**
 * ActionFactory: Creates Action transition nodes
 * Handles button clicks that trigger effects without navigation (e.g., "Find address")
 */
export default class ActionFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform Action transition: In-page actions
   * Handles button clicks that trigger effects without navigation (e.g., "Find address")
   */
  create(json: ActionTransition): ActionTransitionASTNode {
    const when = this.nodeFactory.createNode(json.when)
    const effects = json.effects.map((effect: any) => this.nodeFactory.createNode(effect))

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.TRANSITION,
      transitionType: TransitionType.ACTION,
      properties: {
        when,
        effects,
      },
      raw: json,
    }
  }
}
