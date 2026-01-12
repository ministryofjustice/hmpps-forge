import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { QueryPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'

/**
 * QueryFactory: Creates QUERY pseudo nodes
 *
 * QUERY pseudo nodes represent URL query parameters.
 * They provide access to query string values from the current URL.
 */
export default class QueryFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly category: NodeIDCategory.COMPILE_PSEUDO | NodeIDCategory.RUNTIME_PSEUDO,
  ) {}

  /**
   * Create a QUERY pseudo node
   *
   * @param paramName - The query parameter name
   */
  create(paramName: string): QueryPseudoNode {
    return {
      id: this.nodeIDGenerator.next(this.category),
      type: PseudoNodeType.QUERY,
      properties: {
        paramName,
      },
    }
  }
}
