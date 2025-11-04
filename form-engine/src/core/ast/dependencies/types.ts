import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { PseudoNode } from '@form-engine/core/types/pseudoNodes.type'
import { DependencyEdge } from '@form-engine/core/ast/dependencies/DependencyGraph'

/**
 * Union type representing any node in the dependency graph
 * Can be either an AST node or a pseudo node
 */
export type GraphNode = ASTNode | PseudoNode

/**
 * Complete result of dependency graph analysis
 * Contains all nodes, edges, cycle information, and topological sort
 */
export interface DependencyGraphBuildResult {
  /**
   * All nodes in the dependency graph (AST nodes and pseudo nodes)
   */
  nodes: GraphNode[]

  /**
   * All dependency edges in the graph
   * Each edge represents a dependency relationship: from → to
   * Meaning "to depends on from" or "from must be evaluated before to"
   */
  edges: DependencyEdge[]

  /**
   * Detected circular dependencies
   * Each cycle is represented as an array of NodeIds forming a cycle path
   * Empty array if no cycles detected
   */
  cycles: NodeId[][]

  /**
   * Topological sort of nodes (evaluation order)
   * Nodes are ordered such that dependencies come before dependents
   * Empty array if cycles detected (topological sort not possible with cycles)
   */
  sort: NodeId[]
}
