import { NodeId } from '@form-engine/core/types/engine.type'
import DependencyGraph, { DependencyEdge, DependencyEdgeType } from './DependencyGraph'

/**
 * Overlay dependency graph that delegates to main and pending graphs.
 * - New nodes/edges go to pending
 * - Lookups return union of main and pending
 */
export default class OverlayDependencyGraph extends DependencyGraph {
  constructor(
    private readonly main: DependencyGraph,
    private readonly pending = new DependencyGraph(),
  ) {
    super()
  }

  addNode(nodeId: NodeId): void {
    this.pending.addNode(nodeId)
  }

  addEdge(from: NodeId, to: NodeId, type: DependencyEdgeType, metadata?: unknown): void {
    this.pending.addEdge(from, to, type, metadata)
  }

  getDependents(nodeId: NodeId): Set<NodeId> {
    return new Set<NodeId>([...(this.main.getDependents(nodeId) ?? []), ...(this.pending.getDependents(nodeId) ?? [])])
  }

  getDependencies(nodeId: NodeId): Set<NodeId> {
    return new Set<NodeId>([
      ...(this.main.getDependencies(nodeId) ?? []),
      ...(this.pending.getDependencies(nodeId) ?? []),
    ])
  }

  getEdges(from: NodeId, to: NodeId): DependencyEdge[] {
    return [...this.main.getEdges(from, to), ...this.pending.getEdges(from, to)]
  }

  getAllEdgesFrom(from: NodeId): DependencyEdge[] {
    return [...this.main.getAllEdgesFrom(from), ...this.pending.getAllEdgesFrom(from)]
  }

  getAllNodes(): Set<NodeId> {
    return new Set<NodeId>([...this.main.getAllNodes(), ...this.pending.getAllNodes()])
  }

  hasNode(nodeId: NodeId): boolean {
    return this.main.hasNode(nodeId) || this.pending.hasNode(nodeId)
  }

  size(): number {
    return this.getAllNodes().size
  }

  getAllEdges(): DependencyEdge[] {
    return [...this.main.getAllEdges(), ...this.pending.getAllEdges()]
  }

  clear(): void {
    this.clearPending()
  }

  clearPending(): void {
    this.pending.clear()
  }

  clone(): DependencyGraph {
    throw new Error('Cannot clone an OverlayDependencyGraph - clone the main graph instead')
  }

  flushIntoMain(): void {
    this.pending.getAllNodes().forEach(nodeId => {
      this.main.addNode(nodeId)
    })

    this.pending.getAllEdges().forEach(edge => {
      this.main.addEdge(edge.from, edge.to, edge.type, edge.metadata)
    })

    this.clearPending()
  }

  topologicalSort(): { sort: NodeId[]; cycles: NodeId[][]; hasCycles: boolean } {
    const allNodes = this.getAllNodes()
    const inDegree = new Map<NodeId, number>()

    // Compute in-degree from union(main, pending) without materializing merged edges
    allNodes.forEach(nodeId => {
      const mainDependencies = this.main.getDependencies(nodeId)
      const pendingDependencies = this.pending.getDependencies(nodeId)

      if (pendingDependencies.size === 0) {
        inDegree.set(nodeId, mainDependencies.size)
        return
      }

      if (mainDependencies.size === 0) {
        inDegree.set(nodeId, pendingDependencies.size)
        return
      }

      let degree = mainDependencies.size

      pendingDependencies.forEach(depId => {
        if (!mainDependencies.has(depId)) {
          degree += 1
        }
      })

      inDegree.set(nodeId, degree)
    })

    const queue: NodeId[] = []
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId)
      }
    })

    const sorted: NodeId[] = []
    let queueIndex = 0

    while (queueIndex < queue.length) {
      const nodeId = queue[queueIndex++]!

      sorted.push(nodeId)

      const mainDependents = this.main.getDependents(nodeId)
      const pendingDependents = this.pending.getDependents(nodeId)

      mainDependents.forEach(dependentId => {
        const newDegree = (inDegree.get(dependentId) ?? 0) - 1

        inDegree.set(dependentId, newDegree)
        if (newDegree === 0) {
          queue.push(dependentId)
        }
      })

      pendingDependents.forEach(dependentId => {
        // Avoid double-decrement for edges present in both graphs
        if (mainDependents.has(dependentId)) {
          return
        }

        const newDegree = (inDegree.get(dependentId) ?? 0) - 1

        inDegree.set(dependentId, newDegree)
        if (newDegree === 0) {
          queue.push(dependentId)
        }
      })
    }

    if (sorted.length === allNodes.size) {
      return { sort: sorted, cycles: [], hasCycles: false }
    }

    // Cycle case is exceptional. Fall back to merged graph for full cycle diagnostics.
    const merged = new DependencyGraph()

    allNodes.forEach(nodeId => merged.addNode(nodeId))
    this.getAllEdges().forEach(edge => merged.addEdge(edge.from, edge.to, edge.type, edge.metadata))

    return merged.topologicalSort()
  }

  /**
   * Topological sort of pending nodes only.
   *
   * Use this when you only need the relative order of newly added nodes,
   * not the full graph. O(p + e_p) where p = pending nodes, e_p = pending edges.
   */
  topologicalSortPending(): { sort: NodeId[]; cycles: NodeId[][]; hasCycles: boolean } {
    return this.pending.topologicalSort()
  }
}
