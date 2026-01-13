import { NodeId, ASTNode } from '@form-engine/core/types/engine.type'
import { RuntimeOverlayBuilder, MetadataComputationDependencies } from '@form-engine/core/compilation/thunks/types'
import ThunkCompilerFactory from '@form-engine/core/compilation/thunks/ThunkCompilerFactory'
import ThunkCacheManager from '@form-engine/core/compilation/thunks/ThunkCacheManager'
import { NodeCompilationPipeline } from '@form-engine/core/compilation/NodeCompilationPipeline'
import RegistrationTraverser from '@form-engine/core/compilation/traversers/RegistrationTraverser'
import { NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { CompilationDependencies } from '@form-engine/core/compilation/CompilationDependencies'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'

/**
 * Factory for creating runtime hooks used during thunk evaluation.
 *
 * Runtime hooks enable dynamic node creation and registration during evaluation,
 * supporting features like Collections that generate nodes at runtime based on
 * user input.
 *
 * The factory encapsulates all the complex logic for:
 * - Creating and normalizing runtime AST nodes
 * - Registering nodes and their handlers
 * - Wiring dependencies for runtime nodes
 * - Invalidating caches when new dependencies are added
 */
export default class ThunkRuntimeHooksFactory {
  constructor(
    private readonly compilationDependencies: CompilationDependencies,
    private readonly compiler: ThunkCompilerFactory,
    private readonly cacheManager: ThunkCacheManager,
    private readonly runtimeOverlayBuilder: RuntimeOverlayBuilder,
    private readonly functionRegistry: FunctionRegistry,
  ) {}

  /**
   * Create runtime hooks for a specific node evaluation
   *
   * @param currentNodeId - The node currently being evaluated
   * @returns Runtime hooks object
   */
  create(currentNodeId: NodeId) {
    const runtimeOverlay = this.runtimeOverlayBuilder

    const transformValue = (value: any): any => {
      return runtimeOverlay.nodeFactory.transformValue(value)
    }

    const registerRuntimeNodesBatch = async (nodes: ASTNode[], property: string): Promise<void> => {
      if (nodes.length === 0) {
        return
      }

      const { deps: pendingOverlay, flush, getPendingNodeIds } = this.compilationDependencies.createOverlay()

      nodes.forEach(node => {
        // Phase 1: Normalize nodes
        NodeCompilationPipeline.normalize(node, pendingOverlay, NodeIDCategory.RUNTIME_AST)

        // Phase 2: Register nodes
        new RegistrationTraverser(pendingOverlay.nodeRegistry).register(node)

        // Phase 3: Set node metadata
        pendingOverlay.metadataRegistry.set(node.id, 'attachedToParentNode', currentNodeId)
        pendingOverlay.metadataRegistry.set(node.id, 'attachedToParentProperty', property)
        NodeCompilationPipeline.setRuntimeMetadata(node, pendingOverlay)
      })

      // Phase 4: Add registered AST nodes to the runtime nodes map
      const astNodeIds = getPendingNodeIds()

      astNodeIds
        .map(id => pendingOverlay.nodeRegistry.get(id))
        .forEach((runtimeNode: ASTNode) => {
          runtimeOverlay.runtimeNodes.set(runtimeNode.id, runtimeNode)
        })

      // Phase 5: Create pseudo nodes
      NodeCompilationPipeline.createPseudoNodes(pendingOverlay)

      // Phase 6: Wire dependencies for ALL nodes (AST + pseudo)
      const allPendingIds = getPendingNodeIds()
      NodeCompilationPipeline.wireRuntimeDependencies(pendingOverlay, allPendingIds)

      // Phase 7: Compile handlers for all newly registered nodes
      allPendingIds.forEach(nodeId => {
        const registeredNode = pendingOverlay.nodeRegistry.get(nodeId)

        if (!registeredNode) {
          return
        }

        const compiledHandler = this.compiler.compileASTNode(nodeId, registeredNode)
        pendingOverlay.thunkHandlerRegistry.register(nodeId, compiledHandler)
      })

      // Phase 8: Compute isAsync metadata for hybrid handlers
      const metadataDeps: MetadataComputationDependencies = {
        thunkHandlerRegistry: pendingOverlay.thunkHandlerRegistry,
        functionRegistry: this.functionRegistry,
        nodeRegistry: pendingOverlay.nodeRegistry,
        metadataRegistry: pendingOverlay.metadataRegistry,
      }

      // Use topological sort to compute in dependency order (leaves → roots)
      // This ensures children compute before parents, so parents see accurate isAsync values
      const sortResult = pendingOverlay.dependencyGraph.topologicalSortPending()

      sortResult.sort
        .forEach(nodeId => {
          const handler = pendingOverlay.thunkHandlerRegistry.get(nodeId)

          if (handler) {
            handler.computeIsAsync(metadataDeps)
          }
        })

      // Phase 9: Merge pending → main
      flush()

      // Phase 10: Invalidate caches for ALL pending nodes (AST + pseudo)
      allPendingIds.forEach(nodeId => {
        this.cacheManager.invalidateCascading(nodeId, runtimeOverlay.dependencyGraph)
      })
    }

    return {
      transformValue,
      registerRuntimeNodesBatch,
    }
  }
}
