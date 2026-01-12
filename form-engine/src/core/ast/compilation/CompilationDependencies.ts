import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import OverlayNodeIDGenerator from '@form-engine/core/ast/nodes/OverlayNodeIDGenerator'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import PseudoNodeFactory from '@form-engine/core/ast/nodes/PseudoNodeFactory'
import DependencyGraph from '@form-engine/core/ast/dependencies/DependencyGraph'
import OverlayNodeRegistry from '@form-engine/core/ast/registration/OverlayNodeRegistry'
import OverlayMetadataRegistry from '@form-engine/core/ast/registration/OverlayMetadataRegistry'
import OverlayDependencyGraph from '@form-engine/core/ast/dependencies/OverlayDependencyGraph'
import ThunkHandlerRegistry from '@form-engine/core/ast/thunks/registries/ThunkHandlerRegistry'
import OverlayThunkHandlerRegistry from '@form-engine/core/ast/thunks/registries/OverlayThunkHandlerRegistry'
import { NodeId } from '@form-engine/core/types/engine.type'

export type OverlayDependencies = CompilationDependencies & {
  nodeRegistry: OverlayNodeRegistry
  metadataRegistry: OverlayMetadataRegistry
  dependencyGraph: OverlayDependencyGraph
  thunkHandlerRegistry: OverlayThunkHandlerRegistry
}

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
   * Create an overlay view of the compilation dependencies.
   *
   * Creates overlay wrappers for all dependencies:
   * - NodeIDGenerator: OverlayNodeIDGenerator
   * - NodeFactory: New factory referencing overlay generator
   * - PseudoNodeFactory: New factory referencing overlay generator
   * - NodeRegistry: OverlayNodeRegistry
   * - MetadataRegistry: OverlayMetadataRegistry
   * - DependencyGraph: OverlayDependencyGraph
   * - ThunkHandlerRegistry: OverlayThunkHandlerRegistry
   *
   * Returns overlay deps with flush() and getPendingNodeIds() helpers.
   * Callers choose whether to call flush() - runtime overlays typically don't,
   * while batch/pending views do.
   */
  createOverlay(): {
    deps: OverlayDependencies
    flush: () => void
    getPendingNodeIds: () => NodeId[]
  } {
    const overlayIdGenerator = new OverlayNodeIDGenerator(this.nodeIdGenerator)
    const overlayNodeRegistry = new OverlayNodeRegistry(this.nodeRegistry)
    const overlayMetadata = new OverlayMetadataRegistry(this.metadataRegistry)
    const overlayGraph = new OverlayDependencyGraph(this.dependencyGraph)
    const overlayHandlerRegistry = new OverlayThunkHandlerRegistry(this.thunkHandlerRegistry)

    const deps = new CompilationDependencies(
      overlayIdGenerator,
      new NodeFactory(overlayIdGenerator, NodeIDCategory.RUNTIME_AST),
      new PseudoNodeFactory(overlayIdGenerator, NodeIDCategory.RUNTIME_PSEUDO),
      overlayNodeRegistry,
      overlayMetadata,
      overlayHandlerRegistry,
      overlayGraph,
    ) as OverlayDependencies

    return {
      deps,
      getPendingNodeIds: () => overlayNodeRegistry.getPendingIds(),
      flush: () => {
        overlayIdGenerator.flushIntoMain()
        overlayNodeRegistry.flushIntoMain()
        overlayMetadata.flushIntoMain()
        overlayGraph.flushIntoMain()
        overlayHandlerRegistry.flushIntoMain()
      },
    }
  }
}
