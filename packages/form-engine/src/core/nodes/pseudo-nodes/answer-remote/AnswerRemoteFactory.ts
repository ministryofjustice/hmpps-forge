import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { AnswerRemotePseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'

/**
 * AnswerRemoteFactory: Creates ANSWER_REMOTE pseudo nodes
 *
 * ANSWER_REMOTE pseudo nodes represent field answers for fields on a different step.
 * They only have dependencies on onLoad transitions (value is read from context.answers).
 */
export default class AnswerRemoteFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly category: NodeIDCategory.COMPILE_PSEUDO | NodeIDCategory.RUNTIME_PSEUDO,
  ) {}

  /**
   * Create an ANSWER_REMOTE pseudo node
   *
   * @param baseFieldCode - The base field code (e.g., 'fieldName')
   */
  create(baseFieldCode: string): AnswerRemotePseudoNode {
    return {
      id: this.nodeIDGenerator.next(this.category),
      type: PseudoNodeType.ANSWER_REMOTE,
      properties: {
        baseFieldCode,
      },
    }
  }
}
