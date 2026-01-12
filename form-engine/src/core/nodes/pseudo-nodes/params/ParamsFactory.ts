import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { ParamsPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'

/**
 * ParamsFactory: Creates PARAMS pseudo nodes
 *
 * PARAMS pseudo nodes represent URL path parameters.
 * They provide access to route parameter values from the current URL.
 */
export default class ParamsFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly category: NodeIDCategory.COMPILE_PSEUDO | NodeIDCategory.RUNTIME_PSEUDO,
  ) {}

  /**
   * Create a PARAMS pseudo node
   *
   * @param paramName - The path parameter name
   */
  create(paramName: string): ParamsPseudoNode {
    return {
      id: this.nodeIDGenerator.next(this.category),
      type: PseudoNodeType.PARAMS,
      properties: {
        paramName,
      },
    }
  }
}
