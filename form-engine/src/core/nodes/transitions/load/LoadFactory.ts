import { ASTNodeType } from '@form-engine/core/types/enums'
import { TransitionType } from '@form-engine/form/types/enums'
import { LoadTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { NodeIDGenerator, NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import { LoadTransition } from '@form-engine/form/types/expressions.type'

/**
 * LoadFactory: Creates Load transition nodes
 * Data loading on step/journey access - executes effects before rendering
 */
export default class LoadFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly nodeFactory: NodeFactory,
    private readonly category: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST,
  ) {}

  /**
   * Transform Load transition: Data loading on step/journey access
   * Executes effects before rendering
   */
  create(json: LoadTransition): LoadTransitionASTNode {
    const effects = json.effects.map((effect: any) => this.nodeFactory.createNode(effect))

    return {
      id: this.nodeIDGenerator.next(this.category),
      type: ASTNodeType.TRANSITION,
      transitionType: TransitionType.LOAD,
      properties: {
        effects,
      },
      raw: json,
    }
  }
}
