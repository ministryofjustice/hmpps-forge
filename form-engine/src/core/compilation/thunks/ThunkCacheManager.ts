import { NodeId } from '@form-engine/core/types/engine.type'
import { ThunkResult } from '@form-engine/core/compilation/thunks/types'

/**
 * Manages memoization cache and dirty version tracking for thunk evaluation.
 *
 * Responsibilities:
 * - Cache storage and retrieval for evaluation results
 * - Version counter tracking for dirty detection
 * - Bulk cache clearing when state mutations occur
 *
 * The version counter system allows detection of mid-evaluation invalidations.
 * When a node is invalidated during evaluation, its version increments,
 * signaling to the evaluator that a retry is needed.
 *
 * All nodes are cached. Early evaluation phases (answer pseudo nodes, iterator
 * expansion) benefit from cache hits during the full evaluation pass.
 */
export default class ThunkCacheManager {
  /**
   * Memoization cache for evaluation results
   */
  private cache: Map<NodeId, ThunkResult> = new Map()

  /**
   * Version counter for dirty tracking
   * Incremented when a node is invalidated
   */
  private dirtyVersions: Map<NodeId, number> = new Map()

  /**
   * Reset cache and version counters for a fresh evaluation
   */
  reset(): void {
    this.cache = new Map()
    this.dirtyVersions = new Map()
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
   * Get cached result with cached flag added to metadata
   *
   * Returns undefined if not in cache, otherwise returns the result
   * with metadata.cached set to true.
   */
  getWithCachedFlag<T>(nodeId: NodeId): ThunkResult<T> | undefined {
    if (!this.cache.has(nodeId)) {
      return undefined
    }

    const cached = this.cache.get(nodeId)!

    // Properly handle the discriminated union based on which branch it is
    if ('error' in cached && cached.error) {
      // Error branch - return with cached flag
      return {
        error: cached.error,
        metadata: {
          ...cached.metadata,
          cached: true,
        },
      } as ThunkResult<T>
    }

    // Value branch - return with cached flag
    return {
      value: cached.value,
      metadata: {
        ...cached.metadata,
        cached: true,
      },
    } as ThunkResult<T>
  }

  /**
   * Store result in cache
   */
  set<T>(nodeId: NodeId, result: ThunkResult<T>): void {
    this.cache.set(nodeId, result)
  }

  /**
   * Remove a node from cache
   */
  delete(nodeId: NodeId): void {
    this.cache.delete(nodeId)
  }

  /**
   * Clear all cached results without resetting version counters.
   * Used when state mutations (setAnswer, setData) make cached results potentially stale.
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get current version counter for a node
   */
  getVersion(nodeId: NodeId): number {
    return this.dirtyVersions.get(nodeId) ?? 0
  }

  /**
   * Increment version counter for a node
   */
  incrementVersion(nodeId: NodeId): void {
    const currentVersion = this.dirtyVersions.get(nodeId) ?? 0
    this.dirtyVersions.set(nodeId, currentVersion + 1)
  }

}
