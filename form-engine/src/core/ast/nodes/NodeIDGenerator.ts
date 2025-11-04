import { AstNodeId, NodeId, PseudoNodeId } from '@form-engine/core/types/engine.type'

/**
 * Categories for node IDs
 * Determines prefix and counter namespace
 */
export enum NodeIDCategory {
  COMPILE_AST = 'compile_ast',
  COMPILE_PSEUDO = 'compile_pseudo',
  RUNTIME_AST = 'runtime_ast',
  RUNTIME_PSEUDO = 'runtime_pseudo',
}

/**
 * Generates unique string IDs for nodes
 * Maintains separate counters per category
 */
export class NodeIDGenerator {
  private readonly counters = new Map<NodeIDCategory, number>([
    [NodeIDCategory.COMPILE_AST, 0],
    [NodeIDCategory.COMPILE_PSEUDO, 0],
    [NodeIDCategory.RUNTIME_AST, 0],
    [NodeIDCategory.RUNTIME_PSEUDO, 0],
  ])

  /**
   * Generate next ID in category
   * @param category - Which counter to use
   * @returns String ID like "compile_ast:1"
   */
  next(category: NodeIDCategory.COMPILE_AST): AstNodeId

  next(category: NodeIDCategory.RUNTIME_AST): AstNodeId

  next(category: NodeIDCategory.COMPILE_PSEUDO): PseudoNodeId

  next(category: NodeIDCategory.RUNTIME_PSEUDO): PseudoNodeId

  next(category: NodeIDCategory): NodeId {
    const current = this.counters.get(category)!
    const next = current + 1

    this.counters.set(category, next)

    return `${category}:${next}`
  }

  /**
   * Get current counter value (for debugging)
   * @param category - Which counter to check
   * @returns Current counter value
   */
  getCurrentCount(category: NodeIDCategory): number {
    return this.counters.get(category) ?? 0
  }

  /**
   * Reset counter(s) - primarily for testing
   * @param category - Specific category to reset, or undefined for all
   */
  reset(category?: NodeIDCategory): void {
    if (category) {
      this.counters.set(category, 0)
    } else {
      this.counters.forEach((_, key) => {
        this.counters.set(key, 0)
      })
    }
  }
}
