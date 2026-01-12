import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { DataPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'

/**
 * DataFactory: Creates DATA pseudo nodes
 *
 * DATA pseudo nodes represent external data references.
 * They provide access to data passed into the form engine from the application.
 */
export default class DataFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly category: NodeIDCategory.COMPILE_PSEUDO | NodeIDCategory.RUNTIME_PSEUDO,
  ) {}

  /**
   * Create a DATA pseudo node
   *
   * @param baseProperty - The base property name (e.g., 'userData')
   */
  create(baseProperty: string): DataPseudoNode {
    return {
      id: this.nodeIDGenerator.next(this.category),
      type: PseudoNodeType.DATA,
      properties: {
        baseProperty,
      },
    }
  }
}
