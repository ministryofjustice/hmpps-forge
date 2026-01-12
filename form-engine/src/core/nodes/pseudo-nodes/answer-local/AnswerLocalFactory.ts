import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { AnswerLocalPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { NodeId } from '@form-engine/core/types/engine.type'

/**
 * AnswerLocalFactory: Creates ANSWER_LOCAL pseudo nodes
 *
 * ANSWER_LOCAL pseudo nodes represent field answers for fields on the current step.
 * They have dependencies on POST, formatters, defaultValue, and onLoad transitions.
 */
export default class AnswerLocalFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly category: NodeIDCategory.COMPILE_PSEUDO | NodeIDCategory.RUNTIME_PSEUDO,
  ) {}

  /**
   * Create an ANSWER_LOCAL pseudo node
   *
   * @param baseFieldCode - The base field code (e.g., 'fieldName')
   * @param fieldNodeId - Reference to the field node for dependency tracking
   */
  create(baseFieldCode: string, fieldNodeId: NodeId): AnswerLocalPseudoNode {
    return {
      id: this.nodeIDGenerator.next(this.category),
      type: PseudoNodeType.ANSWER_LOCAL,
      properties: {
        baseFieldCode,
        fieldNodeId,
      },
    }
  }
}
