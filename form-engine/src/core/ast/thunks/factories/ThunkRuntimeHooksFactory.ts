import { NodeId, ASTNode } from '@form-engine/core/types/engine.type'
import { RuntimeOverlayBuilder, MetadataComputationDependencies } from '@form-engine/core/ast/thunks/types'
import ThunkCompilerFactory from '@form-engine/core/ast/thunks/factories/ThunkCompilerFactory'
import ThunkCacheManager from '@form-engine/core/ast/thunks/registries/ThunkCacheManager'
import { NodeCompilationPipeline } from '@form-engine/core/ast/compilation/NodeCompilationPipeline'
import RegistrationTraverser from '@form-engine/core/ast/registration/RegistrationTraverser'
import { NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { CompilationDependencies } from '@form-engine/core/ast/compilation/CompilationDependencies'
import { isHybridHandler } from '@form-engine/core/ast/thunks/typeguards'
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

      // Phase 1: Normalize and register all nodes
      nodes.forEach(node => {
        NodeCompilationPipeline.normalize(node, pendingOverlay, NodeIDCategory.RUNTIME_AST)
        new RegistrationTraverser(pendingOverlay.nodeRegistry).register(node)

        pendingOverlay.metadataRegistry.set(node.id, 'attachedToParentNode', currentNodeId)
        pendingOverlay.metadataRegistry.set(node.id, 'attachedToParentProperty', property)
        NodeCompilationPipeline.setRuntimeMetadata(node, pendingOverlay)
      })

      // Add registered AST nodes to the runtime nodes map
      const astNodeIds = getPendingNodeIds()

      astNodeIds
        .map(id => pendingOverlay.nodeRegistry.get(id))
        .forEach((runtimeNode: ASTNode) => {
          runtimeOverlay.runtimeNodes.set(runtimeNode.id, runtimeNode)
        })

      // Phase 2: Create pseudo nodes
      NodeCompilationPipeline.createPseudoNodes(pendingOverlay)

      // Phase 3: Wire dependencies for ALL nodes (AST + pseudo)
      const allPendingIds = getPendingNodeIds()
      NodeCompilationPipeline.wireDependencies(pendingOverlay, allPendingIds)

      // Phase 4: Compile handlers for all newly registered nodes
      allPendingIds.forEach(nodeId => {
        const registeredNode = pendingOverlay.nodeRegistry.get(nodeId)

        if (!registeredNode) {
          return
        }

        const compiledHandler = this.compiler.compileASTNode(nodeId, registeredNode as any)
        pendingOverlay.thunkHandlerRegistry.register(nodeId, compiledHandler)
      })

      // Phase 4B: Compute isAsync metadata for hybrid handlers
      const metadataDeps: MetadataComputationDependencies = {
        thunkHandlerRegistry: pendingOverlay.thunkHandlerRegistry,
        functionRegistry: this.functionRegistry,
        nodeRegistry: pendingOverlay.nodeRegistry,
        metadataRegistry: pendingOverlay.metadataRegistry,
      }

      // Use topological sort to compute in dependency order (leaves → roots)
      // This ensures children compute before parents, so parents see accurate isAsync values
      const overlayGraph = pendingOverlay.dependencyGraph
      const sortResult = overlayGraph.topologicalSortPending()

      sortResult.sort
        .forEach(nodeId => {
          const handler = pendingOverlay.thunkHandlerRegistry.get(nodeId)

          if (handler && isHybridHandler(handler)) {
            handler.computeIsAsync(metadataDeps)
          }
        })

      // Phase 5: Merge pending → main
      flush()

      // Phase 6: Invalidate caches for ALL pending nodes (AST + pseudo)
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

/**
 * Runtime overlay hooks type - derived from ThunkRuntimeHooksFactory.create()
 *
 * This type is automatically derived from the implementation to ensure
 * the type and implementation stay in sync.
 */
export type RuntimeOverlayHooks = ReturnType<ThunkRuntimeHooksFactory['create']>
