import { NodeId } from '@form-engine/core/types/engine.type'
import { ThunkResult } from '@form-engine/core/compilation/thunks/types'

/**
 * Manages memoization cache for thunk evaluation.
 *
 * All nodes are cached. Early evaluation phases (answer pseudo nodes, iterator
 * expansion) benefit from cache hits during the full evaluation pass.
 */
export default class ThunkCacheManager {
  private cache: Map<NodeId, ThunkResult> = new Map()

  reset(): void {
    this.cache = new Map()
  }

  /**
   * Check if a node has a cached result
   */
  has(nodeId: NodeId): boolean {
    return this.cache.has(nodeId)
  }

  /**
   * Get cached result for a node
   */
  get<T>(nodeId: NodeId): ThunkResult<T> | undefined {
    return this.cache.get(nodeId) as ThunkResult<T> | undefined
  }

  /**
   * Store result in cache
   */
  set<T>(nodeId: NodeId, result: ThunkResult<T>): void {
    this.cache.set(nodeId, result)
  }

  /**
   * Clear all cached results.
   * Used when state mutations (setAnswer, setData) make cached results potentially stale.
   */
  clearCache(): void {
    this.cache.clear()
  }
}
