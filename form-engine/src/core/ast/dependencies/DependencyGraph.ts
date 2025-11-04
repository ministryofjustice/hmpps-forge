import { NodeId } from '@form-engine/core/types/engine.type'

/**
 * Edge types in the dependency graph
 */
export enum DependencyEdgeType {
  /**
   * Structural edges (parent → child)
   * Example: Journey → Step, Step → Block, Block → Field
   */
  STRUCTURAL = 'structural',

  /**
   * Data flow edges (consumer → producer)
   * Example: Field → DefaultValue, Conditional → Predicate
   */
  DATA_FLOW = 'data_flow',

  /**
   * Control flow edges (dependent → condition)
   * Example: Validation → dependent condition
   */
  CONTROL_FLOW = 'control_flow',

  /**
   * Effect flow edges (consumer → effect that populates)
   * Example: Answer → onLoad, Data → onLoad
   */
  EFFECT_FLOW = 'effect_flow',
}

/**
 * Edge in the dependency graph
 * Direction: from → to means "from must come before to" (evaluate from before to)
 * Equivalently: "to depends on from"
 */
export interface DependencyEdge {
  from: NodeId // Node ID that comes first
  to: NodeId // Node ID that depends on 'from'
  type: DependencyEdgeType
  metadata?: unknown // Optional metadata (e.g., property name)
}

/**
 * Graph data structure for dependency tracking
 * Edge direction: A → B means "A must come before B" (evaluate A before B)
 * Equivalently: "B depends on A"
 */
export default class DependencyGraph {
  private readonly adjacencyList: Map<NodeId, Set<NodeId>> = new Map()

  private readonly reverseAdjacencyList: Map<NodeId, Set<NodeId>> = new Map()

  private readonly edges: Map<string, DependencyEdge[]> = new Map()

  private readonly nodes: Set<NodeId> = new Set()

  /**
   * Add a node to the graph
   */
  addNode(nodeId: NodeId): void {
    this.nodes.add(nodeId)
  }

  /**
   * Add an edge: from → to (from must come before to)
   * Edge direction: Evaluate 'from' BEFORE 'to'
   * Equivalently: 'to' depends on 'from'
   */
  addEdge(from: NodeId, to: NodeId, type: DependencyEdgeType, metadata?: unknown): void {
    // Add nodes to graph
    this.nodes.add(from)
    this.nodes.add(to)

    // Forward edge (from → to)
    if (!this.adjacencyList.has(from)) {
      this.adjacencyList.set(from, new Set())
    }

    this.adjacencyList.get(from)!.add(to)

    // Reverse edge (to ← from) for traversal
    if (!this.reverseAdjacencyList.has(to)) {
      this.reverseAdjacencyList.set(to, new Set())
    }

    this.reverseAdjacencyList.get(to)!.add(from)

    // Store edge metadata
    const edgeKey = `${from} → ${to}`

    if (!this.edges.has(edgeKey)) {
      this.edges.set(edgeKey, [])
    }

    this.edges.get(edgeKey)!.push({ from, to, type, metadata })
  }

  /**
   * Get all nodes that depend on 'nodeId' (successors in evaluation order)
   * These are nodes that must be evaluated AFTER 'nodeId'
   */
  getDependents(nodeId: NodeId): Set<NodeId> {
    return this.adjacencyList.get(nodeId) ?? new Set()
  }

  /**
   * Get all nodes that 'nodeId' depends on (predecessors in evaluation order)
   * These are nodes that must be evaluated BEFORE 'nodeId'
   */
  getDependencies(nodeId: NodeId): Set<NodeId> {
    return this.reverseAdjacencyList.get(nodeId) ?? new Set()
  }

  /**
   * Get all edges for a specific node pair
   */
  getEdges(from: NodeId, to: NodeId): DependencyEdge[] {
    return this.edges.get(`${from} → ${to}`) ?? []
  }

  /**
   * Get all nodes in the graph
   */
  getAllNodes(): Set<NodeId> {
    return new Set(this.nodes)
  }

  /**
   * Check if node exists in graph
   */
  hasNode(nodeId: NodeId): boolean {
    return this.nodes.has(nodeId)
  }

  /**
   * Get number of nodes
   */
  size(): number {
    return this.nodes.size
  }

  /**
   * Perform topological sort using Kahn's algorithm
   * Returns sort order (dependencies before dependents) and any detected cycles
   * Does not throw - cycles are returned in the result for caller to handle
   */
  topologicalSort(): { sort: NodeId[]; cycles: NodeId[][]; hasCycles: boolean } {
    // Calculate in-degrees (how many incoming edges each node has)
    // In-degree represents the number of dependencies a node has
    const inDegree = new Map<NodeId, number>()

    this.nodes.forEach(node => {
      // In-degree = number of nodes this node depends on (incoming edges)
      const dependencies = this.reverseAdjacencyList.get(node) ?? new Set()

      inDegree.set(node, dependencies.size)
    })

    // Queue of nodes with no dependencies (in-degree = 0)
    // These are the "root" nodes that can be evaluated first
    const queue: NodeId[] = []

    inDegree.forEach((degree, node) => {
      if (degree === 0) {
        queue.push(node)
      }
    })

    const sorted: NodeId[] = []

    while (queue.length > 0) {
      const node = queue.shift()!

      sorted.push(node)

      // Process dependents (nodes that depend on this node)
      // Use adjacency list to find nodes that come after this one
      const dependents = this.adjacencyList.get(node) ?? new Set()

      dependents.forEach(dependent => {
        const newDegree = (inDegree.get(dependent) ?? 0) - 1

        inDegree.set(dependent, newDegree)

        if (newDegree === 0) {
          queue.push(dependent)
        }
      })
    }

    // Check for cycles and collect all cycle paths
    const cycles: NodeId[][] = []

    if (sorted.length !== this.nodes.size) {
      const sortedSet = new Set(sorted)
      const cycleNodes = Array.from(this.nodes).filter(node => !sortedSet.has(node))
      const visited = new Set<NodeId>()

      // Find all cycles by starting DFS from each unvisited cycle node
      cycleNodes.forEach(startNode => {
        if (!visited.has(startNode)) {
          const cycle = this.findCyclePath([startNode])

          if (cycle.length > 0) {
            cycles.push(cycle)
            // Mark all nodes in this cycle as visited
            cycle.forEach(node => visited.add(node))
          }
        }
      })
    }

    return {
      sort: sorted,
      cycles,
      hasCycles: cycles.length > 0,
    }
  }

  /**
   * Find a cycle path for error reporting
   * Uses DFS to find cycle
   */
  private findCyclePath(cycleNodes: NodeId[]): NodeId[] {
    const visited = new Set<NodeId>()
    const recursionStack = new Set<NodeId>()
    const path: NodeId[] = []

    const dfs = (node: NodeId): NodeId[] | null => {
      visited.add(node)
      recursionStack.add(node)
      path.push(node)

      const deps = this.adjacencyList.get(node) ?? new Set()

      for (const dep of deps) {
        if (!visited.has(dep)) {
          const cycle = dfs(dep)

          if (cycle) {
            return cycle
          }
        } else if (recursionStack.has(dep)) {
          // Found cycle - extract just the cycle portion
          const cycleStartIndex = path.indexOf(dep)

          return [...path.slice(cycleStartIndex), dep]
        }
      }

      path.pop()
      recursionStack.delete(node)

      return null
    }

    // Try to find cycle starting from any cycle node
    for (const node of cycleNodes) {
      if (!visited.has(node)) {
        const cycle = dfs(node)

        if (cycle) {
          return cycle
        }
      }
    }

    return cycleNodes // Fallback if DFS fails
  }
}
