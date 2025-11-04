import { NodeId } from '@form-engine/core/types/engine.type'
import DependencyGraph, { DependencyEdgeType } from './DependencyGraph'

describe('DependencyGraph', () => {
  let graph: DependencyGraph

  beforeEach(() => {
    graph = new DependencyGraph()
  })

  describe('addNode', () => {
    it('should add a node to the graph', () => {
      const nodeId: NodeId = 'compile_ast:1'

      graph.addNode(nodeId)

      expect(graph.hasNode(nodeId)).toBe(true)
    })

    it('should add multiple nodes', () => {
      const nodes: NodeId[] = ['compile_ast:1', 'compile_ast:2', 'compile_ast:3']

      nodes.forEach(node => graph.addNode(node))

      nodes.forEach(node => {
        expect(graph.hasNode(node)).toBe(true)
      })
    })
  })

  describe('size', () => {
    it('should return 0 for empty graph', () => {
      expect(graph.size()).toBe(0)
    })

    it('should return correct size after adding nodes', () => {
      graph.addNode('compile_ast:1')
      graph.addNode('compile_ast:2')
      graph.addNode('compile_ast:3')

      expect(graph.size()).toBe(3)
    })
  })

  describe('hasNode', () => {
    it('should return false for non-existent nodes', () => {
      expect(graph.hasNode('compile_ast:1')).toBe(false)
    })

    it('should return true for added nodes', () => {
      const nodeId: NodeId = 'compile_ast:1'

      graph.addNode(nodeId)

      expect(graph.hasNode(nodeId)).toBe(true)
    })
  })

  describe('getAllNodes', () => {
    it('should return empty set for empty graph', () => {
      const nodes = graph.getAllNodes()

      expect(nodes.size).toBe(0)
    })

    it('should return all added nodes', () => {
      const nodes: NodeId[] = ['compile_ast:1', 'compile_ast:2', 'compile_ast:3']

      nodes.forEach(node => graph.addNode(node))

      const allNodes = graph.getAllNodes()

      expect(allNodes.size).toBe(3)
      nodes.forEach(node => {
        expect(allNodes.has(node)).toBe(true)
      })
    })
  })

  describe('addEdge', () => {
    it('should add an edge between nodes', () => {
      const from: NodeId = 'compile_ast:1'
      const to: NodeId = 'compile_ast:2'

      graph.addNode(from)
      graph.addNode(to)
      graph.addEdge(from, to, DependencyEdgeType.DATA_FLOW)

      const dependents = graph.getDependents(from)
      const dependencies = graph.getDependencies(to)

      expect(dependents.has(to)).toBe(true)
      expect(dependencies.has(from)).toBe(true)
    })

    it('should support multiple edge types between same nodes', () => {
      const from: NodeId = 'compile_ast:1'
      const to: NodeId = 'compile_ast:2'

      graph.addNode(from)
      graph.addNode(to)
      graph.addEdge(from, to, DependencyEdgeType.DATA_FLOW)
      graph.addEdge(from, to, DependencyEdgeType.STRUCTURAL)

      const edges = graph.getEdges(from, to)

      expect(edges).toHaveLength(2)
      expect(edges[0].type).toBe(DependencyEdgeType.DATA_FLOW)
      expect(edges[1].type).toBe(DependencyEdgeType.STRUCTURAL)
    })

    it('should store edge metadata', () => {
      const from: NodeId = 'compile_ast:1'
      const to: NodeId = 'compile_ast:2'
      const metadata = { propertyName: 'defaultValue' }

      graph.addNode(from)
      graph.addNode(to)
      graph.addEdge(from, to, DependencyEdgeType.STRUCTURAL, metadata)

      const edges = graph.getEdges(from, to)

      expect(edges).toHaveLength(1)
      expect(edges[0].metadata).toEqual(metadata)
    })

    it('should support all edge types', () => {
      const a: NodeId = 'compile_ast:1'
      const b: NodeId = 'compile_ast:2'

      graph.addNode(a)
      graph.addNode(b)

      const edgeTypes = [
        DependencyEdgeType.STRUCTURAL,
        DependencyEdgeType.DATA_FLOW,
        DependencyEdgeType.CONTROL_FLOW,
        DependencyEdgeType.EFFECT_FLOW,
      ]

      edgeTypes.forEach(type => {
        graph.addEdge(a, b, type)
      })

      const edges = graph.getEdges(a, b)

      expect(edges).toHaveLength(4)
      edgeTypes.forEach(type => {
        expect(edges.some(e => e.type === type)).toBe(true)
      })
    })
  })

  describe('getDependents', () => {
    it('should return empty set for nodes with no dependents', () => {
      const node: NodeId = 'compile_ast:1'

      graph.addNode(node)

      const dependents = graph.getDependents(node)

      expect(dependents.size).toBe(0)
    })

    it('should return all dependents', () => {
      // A → B, C, D, E
      const a: NodeId = 'compile_ast:1'
      const dependents: NodeId[] = ['compile_ast:2', 'compile_ast:3', 'compile_ast:4', 'compile_ast:5']

      graph.addNode(a)
      dependents.forEach(node => {
        graph.addNode(node)
        graph.addEdge(a, node, DependencyEdgeType.DATA_FLOW)
      })

      const gotDependents = graph.getDependents(a)

      expect(gotDependents.size).toBe(4)
      dependents.forEach(dep => {
        expect(gotDependents.has(dep)).toBe(true)
      })
    })
  })

  describe('getDependencies', () => {
    it('should return empty set for nodes with no dependencies', () => {
      const node: NodeId = 'compile_ast:1'

      graph.addNode(node)

      const dependencies = graph.getDependencies(node)

      expect(dependencies.size).toBe(0)
    })

    it('should return all dependencies', () => {
      // A, B, C, D → E
      const dependencies: NodeId[] = ['compile_ast:1', 'compile_ast:2', 'compile_ast:3', 'compile_ast:4']
      const e: NodeId = 'compile_ast:5'

      graph.addNode(e)
      dependencies.forEach(node => {
        graph.addNode(node)
        graph.addEdge(node, e, DependencyEdgeType.DATA_FLOW)
      })

      const gotDependencies = graph.getDependencies(e)

      expect(gotDependencies.size).toBe(4)
      dependencies.forEach(dep => {
        expect(gotDependencies.has(dep)).toBe(true)
      })
    })
  })

  describe('getEdges', () => {
    it('should return empty array for non-existent edges', () => {
      const from: NodeId = 'compile_ast:1'
      const to: NodeId = 'compile_ast:2'

      graph.addNode(from)
      graph.addNode(to)

      const edges = graph.getEdges(from, to)

      expect(edges).toEqual([])
    })

    it('should return all edges between two nodes', () => {
      const from: NodeId = 'compile_ast:1'
      const to: NodeId = 'compile_ast:2'

      graph.addNode(from)
      graph.addNode(to)
      graph.addEdge(from, to, DependencyEdgeType.DATA_FLOW, { test: 'data1' })
      graph.addEdge(from, to, DependencyEdgeType.STRUCTURAL, { test: 'data2' })

      const edges = graph.getEdges(from, to)

      expect(edges).toHaveLength(2)
      expect(edges[0].from).toBe(from)
      expect(edges[0].to).toBe(to)
      expect(edges[1].from).toBe(from)
      expect(edges[1].to).toBe(to)
    })
  })

  describe('topologicalSort', () => {
    describe('when graph is acyclic', () => {
      it('should return empty sort for empty graph', () => {
        const result = graph.topologicalSort()

        expect(result.sort).toEqual([])
        expect(result.cycles).toEqual([])
        expect(result.hasCycles).toBe(false)
      })

      it('should return single node for graph with one node', () => {
        const node: NodeId = 'compile_ast:1'

        graph.addNode(node)

        const result = graph.topologicalSort()

        expect(result.sort).toEqual([node])
        expect(result.cycles).toEqual([])
        expect(result.hasCycles).toBe(false)
      })

      it('should return nodes in dependency order for linear chain', () => {
        // A → B → C → D
        const nodes: NodeId[] = ['compile_ast:1', 'compile_ast:2', 'compile_ast:3', 'compile_ast:4']

        nodes.forEach(node => graph.addNode(node))
        graph.addEdge(nodes[0], nodes[1], DependencyEdgeType.DATA_FLOW)
        graph.addEdge(nodes[1], nodes[2], DependencyEdgeType.DATA_FLOW)
        graph.addEdge(nodes[2], nodes[3], DependencyEdgeType.DATA_FLOW)

        const result = graph.topologicalSort()

        expect(result.sort).toEqual(nodes)
        expect(result.hasCycles).toBe(false)
      })

      it('should return nodes with dependencies before dependents for tree structure', () => {
        //     A
        //    / \
        //   B   C
        //  / \
        // D   E
        const a: NodeId = 'compile_ast:1'
        const b: NodeId = 'compile_ast:2'
        const c: NodeId = 'compile_ast:3'
        const d: NodeId = 'compile_ast:4'
        const e: NodeId = 'compile_ast:5'

        ;[a, b, c, d, e].forEach(node => graph.addNode(node))
        graph.addEdge(a, b, DependencyEdgeType.STRUCTURAL)
        graph.addEdge(a, c, DependencyEdgeType.STRUCTURAL)
        graph.addEdge(b, d, DependencyEdgeType.STRUCTURAL)
        graph.addEdge(b, e, DependencyEdgeType.STRUCTURAL)

        const result = graph.topologicalSort()

        // A must come first
        expect(result.sort[0]).toBe(a)
        // B must come before D and E
        const bIndex = result.sort.indexOf(b)
        const dIndex = result.sort.indexOf(d)
        const eIndex = result.sort.indexOf(e)

        expect(bIndex).toBeLessThan(dIndex)
        expect(bIndex).toBeLessThan(eIndex)
        expect(result.hasCycles).toBe(false)
      })

      it('should sort all components for disconnected graph', () => {
        // A → B    C → D
        const a: NodeId = 'compile_ast:1'
        const b: NodeId = 'compile_ast:2'
        const c: NodeId = 'compile_ast:3'
        const d: NodeId = 'compile_ast:4'

        ;[a, b, c, d].forEach(node => graph.addNode(node))
        graph.addEdge(a, b, DependencyEdgeType.DATA_FLOW)
        graph.addEdge(c, d, DependencyEdgeType.DATA_FLOW)

        const result = graph.topologicalSort()

        expect(result.sort).toHaveLength(4)
        expect(result.hasCycles).toBe(false)

        // A before B, C before D
        const aIndex = result.sort.indexOf(a)
        const bIndex = result.sort.indexOf(b)
        const cIndex = result.sort.indexOf(c)
        const dIndex = result.sort.indexOf(d)

        expect(aIndex).toBeLessThan(bIndex)
        expect(cIndex).toBeLessThan(dIndex)
      })
    })

    describe('when graph has cycles', () => {
      it('should detect self-loop', () => {
        const node: NodeId = 'compile_ast:1'

        graph.addNode(node)
        graph.addEdge(node, node, DependencyEdgeType.DATA_FLOW)

        const result = graph.topologicalSort()

        expect(result.hasCycles).toBe(true)
        expect(result.cycles).toHaveLength(1)
        expect(result.cycles[0]).toEqual([node, node])
      })

      it('should detect two-node cycle', () => {
        // A → B → A
        const a: NodeId = 'compile_ast:1'
        const b: NodeId = 'compile_ast:2'

        graph.addNode(a)
        graph.addNode(b)
        graph.addEdge(a, b, DependencyEdgeType.DATA_FLOW)
        graph.addEdge(b, a, DependencyEdgeType.DATA_FLOW)

        const result = graph.topologicalSort()

        expect(result.hasCycles).toBe(true)
        expect(result.cycles).toHaveLength(1)

        const cycle = result.cycles[0]

        expect(cycle).toHaveLength(3) // [A, B, A] or [B, A, B]
        expect(cycle[0]).toBe(cycle[cycle.length - 1]) // Cycle closes
      })

      it('should detect three-node cycle', () => {
        // A → B → C → A
        const a: NodeId = 'compile_ast:1'
        const b: NodeId = 'compile_ast:2'
        const c: NodeId = 'compile_ast:3'

        graph.addNode(a)
        graph.addNode(b)
        graph.addNode(c)
        graph.addEdge(a, b, DependencyEdgeType.DATA_FLOW)
        graph.addEdge(b, c, DependencyEdgeType.DATA_FLOW)
        graph.addEdge(c, a, DependencyEdgeType.DATA_FLOW)

        const result = graph.topologicalSort()

        expect(result.hasCycles).toBe(true)
        expect(result.cycles).toHaveLength(1)

        const cycle = result.cycles[0]

        expect(cycle).toHaveLength(4) // [node, node, node, node] where first === last
        expect(cycle[0]).toBe(cycle[cycle.length - 1])
      })

      it('should detect multiple independent cycles', () => {
        // Cycle 1: A → B → A
        // Cycle 2: C → D → C
        const a: NodeId = 'compile_ast:1'
        const b: NodeId = 'compile_ast:2'
        const c: NodeId = 'compile_ast:3'
        const d: NodeId = 'compile_ast:4'

        ;[a, b, c, d].forEach(node => graph.addNode(node))

        // First cycle
        graph.addEdge(a, b, DependencyEdgeType.DATA_FLOW)
        graph.addEdge(b, a, DependencyEdgeType.DATA_FLOW)

        // Second cycle
        graph.addEdge(c, d, DependencyEdgeType.DATA_FLOW)
        graph.addEdge(d, c, DependencyEdgeType.DATA_FLOW)

        const result = graph.topologicalSort()

        expect(result.hasCycles).toBe(true)
        expect(result.cycles).toHaveLength(2)

        // Verify both cycles are detected
        const cycleNodes = result.cycles.flat()

        expect(cycleNodes).toContain(a)
        expect(cycleNodes).toContain(b)
        expect(cycleNodes).toContain(c)
        expect(cycleNodes).toContain(d)
      })

      it('should detect cycle and sort acyclic parts', () => {
        // A → B → C
        //     ↓   ↑
        //     → D →  (cycle: B → D → C → B or B → C → B)
        // E → F (acyclic)
        const a: NodeId = 'compile_ast:1'
        const b: NodeId = 'compile_ast:2'
        const c: NodeId = 'compile_ast:3'
        const d: NodeId = 'compile_ast:4'
        const e: NodeId = 'compile_ast:5'
        const f: NodeId = 'compile_ast:6'

        ;[a, b, c, d, e, f].forEach(node => graph.addNode(node))

        // Acyclic part
        graph.addEdge(a, b, DependencyEdgeType.DATA_FLOW)
        graph.addEdge(e, f, DependencyEdgeType.DATA_FLOW)

        // Cycle
        graph.addEdge(b, c, DependencyEdgeType.DATA_FLOW)
        graph.addEdge(b, d, DependencyEdgeType.DATA_FLOW)
        graph.addEdge(d, c, DependencyEdgeType.DATA_FLOW)
        graph.addEdge(c, b, DependencyEdgeType.DATA_FLOW)

        const result = graph.topologicalSort()

        expect(result.hasCycles).toBe(true)
        expect(result.cycles.length).toBeGreaterThan(0)

        // Acyclic nodes should still be in sort
        const sortSet = new Set(result.sort)

        expect(sortSet.has(a)).toBe(true)
        expect(sortSet.has(e)).toBe(true)
        expect(sortSet.has(f)).toBe(true)

        // Core cycle nodes (B, C) should be detected
        const cycleNodes = new Set(result.cycles.flat())

        expect(cycleNodes.has(b)).toBe(true)
        expect(cycleNodes.has(c)).toBe(true)

        // B and C should not be in sort (they're in the cycle)
        expect(sortSet.has(b)).toBe(false)
        expect(sortSet.has(c)).toBe(false)
      })

      it('should detect nested cycles', () => {
        // A → B → C → D
        //     ↑   ↓
        //     ← ← E
        // Cycle: B → C → E → B
        const a: NodeId = 'compile_ast:1'
        const b: NodeId = 'compile_ast:2'
        const c: NodeId = 'compile_ast:3'
        const d: NodeId = 'compile_ast:4'
        const e: NodeId = 'compile_ast:5'

        ;[a, b, c, d, e].forEach(node => graph.addNode(node))

        graph.addEdge(a, b, DependencyEdgeType.DATA_FLOW)
        graph.addEdge(b, c, DependencyEdgeType.DATA_FLOW)
        graph.addEdge(c, d, DependencyEdgeType.DATA_FLOW)
        graph.addEdge(c, e, DependencyEdgeType.DATA_FLOW)
        graph.addEdge(e, b, DependencyEdgeType.DATA_FLOW) // Back edge creates cycle

        const result = graph.topologicalSort()

        expect(result.hasCycles).toBe(true)
        expect(result.cycles.length).toBeGreaterThan(0)

        // Collect all nodes involved in any cycle
        const cycleNodes = new Set(result.cycles.flat())

        // Cycle should contain B, C, E
        expect(cycleNodes.has(b)).toBe(true)
        expect(cycleNodes.has(c)).toBe(true)
        expect(cycleNodes.has(e)).toBe(true)

        // A should be in sorted part (no cycle)
        expect(result.sort).toContain(a)
      })
    })

    describe('return value structure', () => {
      it('should have correct properties', () => {
        const a: NodeId = 'compile_ast:1'
        const b: NodeId = 'compile_ast:2'

        graph.addNode(a)
        graph.addNode(b)
        graph.addEdge(a, b, DependencyEdgeType.DATA_FLOW)

        const result = graph.topologicalSort()

        expect(result).toHaveProperty('sort')
        expect(result).toHaveProperty('cycles')
        expect(result).toHaveProperty('hasCycles')
        expect(Array.isArray(result.sort)).toBe(true)
        expect(Array.isArray(result.cycles)).toBe(true)
        expect(typeof result.hasCycles).toBe('boolean')
      })

      it('should have cycles as array of arrays for cyclic graph', () => {
        const a: NodeId = 'compile_ast:1'
        const b: NodeId = 'compile_ast:2'

        graph.addNode(a)
        graph.addNode(b)
        graph.addEdge(a, b, DependencyEdgeType.DATA_FLOW)
        graph.addEdge(b, a, DependencyEdgeType.DATA_FLOW)

        const result = graph.topologicalSort()

        expect(result.hasCycles).toBe(true)
        expect(Array.isArray(result.cycles)).toBe(true)
        expect(result.cycles.length).toBeGreaterThan(0)
        expect(Array.isArray(result.cycles[0])).toBe(true)
      })
    })
  })
})
