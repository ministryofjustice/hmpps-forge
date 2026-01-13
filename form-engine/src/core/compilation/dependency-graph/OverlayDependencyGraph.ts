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
    const merged = new DependencyGraph()

    this.getAllNodes().forEach(nodeId => merged.addNode(nodeId))
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
