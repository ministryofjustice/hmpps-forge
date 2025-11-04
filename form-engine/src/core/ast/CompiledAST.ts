import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import DependencyGraph, { DependencyEdge } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { JourneyASTNode } from '@form-engine/core/types/structures.type'
import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import { CompileStageDependencies } from '@form-engine/core/container/compileStageContainer'
import { DependencyGraphBuildResult, GraphNode } from '@form-engine/core/ast/dependencies/types'
import { formatBox } from '@form-engine/logging/formatBox'

export default class CompiledAST {
  private constructor(
    private readonly root: JourneyASTNode,
    private readonly nodeRegistry: NodeRegistry,
    private readonly pseudoNodeRegistry: NodeRegistry,
    private readonly dependencyGraph: DependencyGraph,
  ) {}

  static createFrom(json: JourneyDefinition, services: CompileStageDependencies): CompiledAST {
    // Phase 1A: Transform JSON to AST
    const root = services.nodeFactory.createNode(json) as JourneyASTNode

    // Phase 1B: Normalize AST
    services.normalizers.addSelfValue.normalize(root)
    services.normalizers.resolveSelfReferences.normalize(root)
    services.normalizers.attachValidationBlockCode.normalize(root)
    services.normalizers.convertFormatters.normalize(root)
    services.normalizers.attachParentNodes.normalize(root)

    // Phase 2A: Register AST nodes with IDs
    services.registers.configurationNodes.register(root)

    // Phase 2B: Discover and register pseudo nodes
    services.registers.pseudoNodes.register(root)

    // Phase 3: Dependency analysis
    services.dependency.wiring.build()

    const sortResult = services.dependency.dependencyGraph.topologicalSort()

    // TODO: Probably should decide if we actually just throw here, i mean, you're pretty fudged otherwise
    if (sortResult.hasCycles) {
      const formCode = root.properties.get('code')
      const cycleCount = sortResult.cycles.length
      const cyclePaths = sortResult.cycles.map(cycle => cycle.join(' → ')).join('\n')

      const message = [
        { label: 'Form', value: formCode },
        { label: 'Cycles', value: `${cycleCount} circular ${cycleCount === 1 ? 'dependency' : 'dependencies'}` },
        { label: 'Paths', value: cyclePaths },
      ]

      services.logger.warn(formatBox(message, { title: 'Circular Dependencies Warning' }))
    }

    return new CompiledAST(
      root as JourneyASTNode,
      services.astNodeRegistry,
      services.pseudoNodeRegistry,
      services.dependency.dependencyGraph,
    )
  }

  // Getters for accessing internal state
  getRoot(): JourneyASTNode {
    return this.root
  }

  getNodeRegistry(): NodeRegistry {
    return this.nodeRegistry
  }

  /**
   * Get complete dependency analysis result
   * Includes all nodes, edges, cycles, and topological sort
   */
  getDependencyAnalysis(): DependencyGraphBuildResult {
    // Collect all nodes from both registries
    const nodes: GraphNode[] = []

    // Add all AST nodes
    for (const entry of this.nodeRegistry.getAllEntries().values()) {
      nodes.push(entry.node)
    }

    // Add all pseudo nodes
    for (const entry of this.pseudoNodeRegistry.getAllEntries().values()) {
      nodes.push(entry.node)
    }

    // Extract all edges from the dependency graph
    const edges: DependencyEdge[] = []
    const allNodeIds = this.dependencyGraph.getAllNodes()

    for (const fromId of allNodeIds) {
      const dependents = this.dependencyGraph.getDependents(fromId)

      for (const toId of dependents) {
        const nodeEdges = this.dependencyGraph.getEdges(fromId, toId)

        edges.push(...nodeEdges)
      }
    }

    // Get topological sort with cycle detection
    const sortResult = this.dependencyGraph.topologicalSort()

    return {
      nodes,
      edges,
      cycles: sortResult.cycles,
      sort: sortResult.sort,
    }
  }
}
