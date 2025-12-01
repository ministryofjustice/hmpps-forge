import { NodeId } from '@form-engine/core/types/engine.type'
import { ThunkResult } from '@form-engine/core/ast/thunks/types'
import DependencyGraph from '@form-engine/core/ast/dependencies/DependencyGraph'

/**
 * Manages memoization cache and dirty version tracking for thunk evaluation.
 *
 * Responsibilities:
 * - Cache storage and retrieval for evaluation results
 * - Version counter tracking for dirty detection
 * - Cascading cache invalidation through dependency graph
 *
 * The version counter system allows detection of mid-evaluation invalidations.
 * When a node is invalidated during evaluation, its version increments,
 * signaling to the evaluator that a retry is needed.
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

  /**
   * Invalidate cache for a node, cascading through all dependent nodes
   *
   * When a new dependency edge is added at runtime (e.g., Field C → OnSubmit),
   * the target node's cached result becomes stale because it was computed before
   * the new dependency existed. This method ensures correctness by cascading
   * the invalidation through the entire dependency chain:
   *
   * 1. Skip if already visited (prevents cycles and diamond duplicates)
   * 2. Increment the node's version counter (marks as dirty)
   * 3. Remove the node from cache (if cached)
   * 4. Find all nodes that depend on it (via adjacency list)
   * 5. Recursively invalidate those dependents (cascade continues)
   *
   * The version counter increment happens REGARDLESS of cache status, allowing
   * in-flight evaluations to detect they were invalidated mid-execution and retry.
   *
   * The visited set ensures each node is invalidated exactly once, handling:
   * - Circular dependencies (A → B → A) without infinite recursion
   * - Diamond patterns (A → B → D, A → C → D) without double-incrementing D
   *
   * @param nodeId - The node to invalidate
   * @param graph - Dependency graph for finding dependents
   * @param visited - Set of already-invalidated nodes (used internally for recursion)
   */
  invalidateCascading(nodeId: NodeId, graph: DependencyGraph, visited: Set<NodeId> = new Set()): void {
    if (visited.has(nodeId)) {
      return
    }

    visited.add(nodeId)

    // Always increment version counter (even if not cached)
    // This allows in-flight evaluations to detect they were invalidated
    this.incrementVersion(nodeId)

    // Remove from cache if present
    if (this.cache.has(nodeId)) {
      this.cache.delete(nodeId)
    }

    // Cascade: invalidate all nodes that depend on this one
    // getDependents returns nodes that must be evaluated AFTER nodeId
    const dependents = graph.getDependents(nodeId)

    dependents.forEach((dependentId: NodeId) => {
      this.invalidateCascading(dependentId, graph, visited)
    })
  }
}
