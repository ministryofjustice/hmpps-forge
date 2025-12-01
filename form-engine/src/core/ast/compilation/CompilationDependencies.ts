import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import { PseudoNodeFactory } from '@form-engine/core/ast/nodes/PseudoNodeFactory'
import ThunkHandlerRegistry from '@form-engine/core/ast/thunks/registries/ThunkHandlerRegistry'
import DependencyGraph from '@form-engine/core/ast/dependencies/DependencyGraph'
import OverlayNodeRegistry from '@form-engine/core/ast/registration/OverlayNodeRegistry'
import OverlayMetadataRegistry from '@form-engine/core/ast/registration/OverlayMetadataRegistry'
import OverlayDependencyGraph from '@form-engine/core/ast/dependencies/OverlayDependencyGraph'
import { NodeId } from '@form-engine/core/types/engine.type'

export class CompilationDependencies {
  constructor(
    readonly nodeIdGenerator = new NodeIDGenerator(),
    readonly nodeFactory = new NodeFactory(nodeIdGenerator, NodeIDCategory.COMPILE_AST),
    readonly pseudoNodeFactory = new PseudoNodeFactory(nodeIdGenerator, NodeIDCategory.COMPILE_PSEUDO),
    readonly nodeRegistry: NodeRegistry = new NodeRegistry(),
    readonly metadataRegistry: MetadataRegistry = new MetadataRegistry(),
    readonly thunkHandlerRegistry = new ThunkHandlerRegistry(),
    readonly dependencyGraph: DependencyGraph = new DependencyGraph(),
  ) {}

  clone() {
    const clonedNodeIdGenerator = this.nodeIdGenerator.clone()
    const clonedNodeFactory = new NodeFactory(clonedNodeIdGenerator, NodeIDCategory.COMPILE_AST)
    const clonedPseudoNodeFactory = new PseudoNodeFactory(clonedNodeIdGenerator, NodeIDCategory.COMPILE_PSEUDO)
    const clonedNodeRegistry = this.nodeRegistry.clone()
    const clonedMetadataRegistry = this.metadataRegistry.clone()
    const clonedThunkHandlerRegistry = this.thunkHandlerRegistry.clone()
    const clonedDependencyGraph = this.dependencyGraph.clone()

    return new CompilationDependencies(
      clonedNodeIdGenerator,
      clonedNodeFactory,
      clonedPseudoNodeFactory,
      clonedNodeRegistry,
      clonedMetadataRegistry,
      clonedThunkHandlerRegistry,
      clonedDependencyGraph,
    )
  }

  /**
   * Create a pending/scoped view of the compilation dependencies.
   * - Iteration over AST nodes is pending-only
   * - Lookups fall back to main
   * - Pseudo iteration is union to allow wiring from existing pseudos to new refs
   * - flush() merges pending into main
   */
  createPendingView(): {
    deps: CompilationDependencies
    flush: () => void
    getPendingNodeIds: () => NodeId[]
  } {
    const overlayNodeRegistry = new OverlayNodeRegistry(this.nodeRegistry)
    const overlayMetadata = new OverlayMetadataRegistry(this.metadataRegistry)
    const overlayGraph = new OverlayDependencyGraph(this.dependencyGraph)

    const deps = new CompilationDependencies(
      this.nodeIdGenerator,
      this.nodeFactory,
      this.pseudoNodeFactory,
      overlayNodeRegistry,
      overlayMetadata,
      this.thunkHandlerRegistry,
      overlayGraph,
    )

    return {
      deps,
      getPendingNodeIds: () => overlayNodeRegistry.getPendingIds(),
      flush: () => {
        overlayNodeRegistry.flushIntoMain()
        overlayGraph.flushIntoMain()
        overlayMetadata.flushIntoMain()
      },
    }
  }
}
