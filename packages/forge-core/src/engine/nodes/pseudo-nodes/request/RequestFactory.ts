import { NodeIDCategory, NodeIDGenerator } from '../../../compilation/id-generators/NodeIDGenerator'
import { RequestPseudoNode, PseudoNodeType } from '../../../types/pseudoNodes.type'

/**
 * RequestFactory: Creates REQUEST pseudo nodes
 *
 * REQUEST pseudo nodes represent request metadata exposed via Request.*
 */
export default class RequestFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly category: NodeIDCategory.COMPILE_PSEUDO | NodeIDCategory.RUNTIME_PSEUDO,
  ) {}

  create(requestPath: string): RequestPseudoNode {
    return {
      id: this.nodeIDGenerator.next(this.category),
      type: PseudoNodeType.REQUEST,
      properties: {
        requestPath,
      },
    }
  }
}
