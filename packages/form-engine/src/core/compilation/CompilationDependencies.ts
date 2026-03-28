import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import OverlayNodeIDGenerator from '@form-engine/core/compilation/id-generators/OverlayNodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import NodeRegistry from '@form-engine/core/compilation/registries/NodeRegistry'
import MetadataRegistry from '@form-engine/core/compilation/registries/MetadataRegistry'
import PseudoNodeFactory from '@form-engine/core/nodes/PseudoNodeFactory'
import OverlayNodeRegistry from '@form-engine/core/compilation/registries/OverlayNodeRegistry'
import OverlayMetadataRegistry from '@form-engine/core/compilation/registries/OverlayMetadataRegistry'
import ThunkHandlerRegistry from '@form-engine/core/compilation/registries/ThunkHandlerRegistry'
import OverlayThunkHandlerRegistry from '@form-engine/core/compilation/registries/OverlayThunkHandlerRegistry'
import ASTNodeTree from '@form-engine/core/compilation/node-tree/ASTNodeTree'
import OverlayASTNodeTree from '@form-engine/core/compilation/node-tree/OverlayASTNodeTree'
import { NodeId } from '@form-engine/core/types/engine.type'

export type OverlayDependencies = CompilationDependencies & {
  nodeRegistry: OverlayNodeRegistry
  metadataRegistry: OverlayMetadataRegistry
  thunkHandlerRegistry: OverlayThunkHandlerRegistry
  astNodeTree: OverlayASTNodeTree
}

export class CompilationDependencies {
  constructor(
    readonly nodeIdGenerator = new NodeIDGenerator(),
    readonly nodeFactory = new NodeFactory(nodeIdGenerator, NodeIDCategory.COMPILE_AST),
    readonly pseudoNodeFactory = new PseudoNodeFactory(nodeIdGenerator, NodeIDCategory.COMPILE_PSEUDO),
    readonly nodeRegistry: NodeRegistry = new NodeRegistry(),
    readonly metadataRegistry: MetadataRegistry = new MetadataRegistry(),
    readonly thunkHandlerRegistry = new ThunkHandlerRegistry(),
    readonly astNodeTree: ASTNodeTree = new ASTNodeTree(),
  ) {}

  clone() {
    const clonedNodeIdGenerator = this.nodeIdGenerator.clone()
    const clonedNodeFactory = new NodeFactory(clonedNodeIdGenerator, NodeIDCategory.COMPILE_AST)
    const clonedPseudoNodeFactory = new PseudoNodeFactory(clonedNodeIdGenerator, NodeIDCategory.COMPILE_PSEUDO)
    const clonedNodeRegistry = this.nodeRegistry.clone()
    const clonedMetadataRegistry = this.metadataRegistry.clone()
    const clonedThunkHandlerRegistry = this.thunkHandlerRegistry.clone()
    const clonedAstNodeTree = this.astNodeTree.clone()

    return new CompilationDependencies(
      clonedNodeIdGenerator,
      clonedNodeFactory,
      clonedPseudoNodeFactory,
      clonedNodeRegistry,
      clonedMetadataRegistry,
      clonedThunkHandlerRegistry,
      clonedAstNodeTree,
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
    const overlayHandlerRegistry = new OverlayThunkHandlerRegistry(this.thunkHandlerRegistry)
    const overlayTree = new OverlayASTNodeTree(this.astNodeTree)

    const deps = new CompilationDependencies(
      overlayIdGenerator,
      new NodeFactory(overlayIdGenerator, NodeIDCategory.RUNTIME_AST),
      new PseudoNodeFactory(overlayIdGenerator, NodeIDCategory.RUNTIME_PSEUDO),
      overlayNodeRegistry,
      overlayMetadata,
      overlayHandlerRegistry,
      overlayTree,
    ) as OverlayDependencies

    return {
      deps,
      getPendingNodeIds: () => overlayNodeRegistry.getPendingIds(),
      flush: () => {
        overlayIdGenerator.flushIntoMain()
        overlayNodeRegistry.flushIntoMain()
        overlayMetadata.flushIntoMain()
        overlayHandlerRegistry.flushIntoMain()
        overlayTree.flushIntoMain()
      },
    }
  }
}
