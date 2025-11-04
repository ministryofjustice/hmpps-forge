import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import DependencyGraph from '@form-engine/core/ast/dependencies/DependencyGraph'
import ScopeIndex from '@form-engine/core/ast/dependencies/ScopeIndex'
import { wireStructuralHierarchy } from '@form-engine/core/ast/dependencies/wiring/wireStructuralHierarchy'
import { wireAnswerPseudoNodes } from '@form-engine/core/ast/dependencies/wiring/wireAnswerPseudoNodes'
import { wireDataPseudoNodes } from '@form-engine/core/ast/dependencies/wiring/wireDataPseudoNodes'
import { wireExpressionNodes } from '@form-engine/core/ast/dependencies/wiring/wireExpressionNodes'

/**
 * Traverser that builds dependency graph.
 * Follows same pattern as RegistrationTraverser.
 * Scope information is computed on-demand by ScopeIndex walking up parent chains.
 */
export default class DependencyWiringTraverser {
  constructor(
    private readonly astNodeRegistry: NodeRegistry,
    private readonly pseudoNodeRegistry: NodeRegistry,
    private readonly graph: DependencyGraph,
    private readonly scopeIndex: ScopeIndex,
  ) {}

  /**
   * Main entry point - traverse journey and wire all dependencies
   */
  build(): void {
    // Add all registered nodes to the graph first
    this.addNodesToGraph()

    wireStructuralHierarchy(this.astNodeRegistry, this.graph)
    wireAnswerPseudoNodes(this.astNodeRegistry, this.pseudoNodeRegistry, this.graph, this.scopeIndex)
    wireDataPseudoNodes(this.astNodeRegistry, this.pseudoNodeRegistry, this.graph, this.scopeIndex)
    wireExpressionNodes(this.astNodeRegistry, this.pseudoNodeRegistry, this.graph)
  }

  /**
   * Add all registered nodes to the dependency graph
   */
  private addNodesToGraph(): void {
    // Add AST nodes
    this.astNodeRegistry.getIds().forEach(id => {
      this.graph.addNode(id)
    })

    // Add pseudo nodes
    this.pseudoNodeRegistry.getIds().forEach(id => {
      this.graph.addNode(id)
    })
  }
}
