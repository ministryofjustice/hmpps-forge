import { PseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'

/**
 * Extract the lookup key from a pseudo node based on its type
 *
 * Different pseudo node types use different property names for their key:
 * - DATA → baseProperty
 * - POST, ANSWER_LOCAL, ANSWER_REMOTE → baseFieldCode
 * - QUERY, PARAMS → paramName
 *
 * @returns The key string, or undefined if the node type is unsupported
 */
export function getPseudoNodeKey(node: PseudoNode): string | undefined {
  switch (node.type) {
    case PseudoNodeType.DATA:
      return node.properties.baseProperty

    case PseudoNodeType.POST:
    case PseudoNodeType.ANSWER_LOCAL:
    case PseudoNodeType.ANSWER_REMOTE:
      return node.properties.baseFieldCode

    case PseudoNodeType.QUERY:
    case PseudoNodeType.PARAMS:
      return node.properties.paramName

    default:
      return undefined
  }
}
