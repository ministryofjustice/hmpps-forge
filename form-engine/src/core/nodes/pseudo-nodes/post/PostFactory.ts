import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { PostPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { NodeId } from '@form-engine/core/types/engine.type'

/**
 * PostFactory: Creates POST pseudo nodes
 *
 * POST pseudo nodes represent form submission data for a field.
 * They are the raw values submitted by the user before any transformation.
 */
export default class PostFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly category: NodeIDCategory.COMPILE_PSEUDO | NodeIDCategory.RUNTIME_PSEUDO,
  ) {}

  /**
   * Create a POST pseudo node
   *
   * @param baseFieldCode - The base field code (e.g., 'fieldName')
   * @param fieldNodeId - Optional reference to the field node for accessing field properties
   */
  create(baseFieldCode: string, fieldNodeId?: NodeId): PostPseudoNode {
    return {
      id: this.nodeIDGenerator.next(this.category),
      type: PseudoNodeType.POST,
      properties: {
        baseFieldCode,
        fieldNodeId,
      },
    }
  }
}
