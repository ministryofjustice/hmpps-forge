import { NodeIDCategory, NodeIDGenerator } from '../../../compilation/id-generators/NodeIDGenerator'
import { PseudoNodeType, SessionPseudoNode } from '../../../types/pseudoNodes.type'

/**
 * SessionFactory: Creates SESSION pseudo nodes
 *
 * SESSION pseudo nodes represent server-side session data exposed via Session().
 */
export default class SessionFactory {
  constructor(
    private readonly nodeIDGenerator: NodeIDGenerator,
    private readonly category: NodeIDCategory.COMPILE_PSEUDO | NodeIDCategory.RUNTIME_PSEUDO,
  ) {}

  create(baseSessionKey: string): SessionPseudoNode {
    return {
      id: this.nodeIDGenerator.next(this.category),
      type: PseudoNodeType.SESSION,
      properties: {
        baseSessionKey,
      },
    }
  }
}
