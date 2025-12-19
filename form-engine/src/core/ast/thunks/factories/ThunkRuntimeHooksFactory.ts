import { NodeId, ASTNode } from '@form-engine/core/types/engine.type'
import { RuntimeOverlayHooks, RuntimeOverlayBuilder } from '@form-engine/core/ast/thunks/types'
import ThunkCompilerFactory from '@form-engine/core/ast/thunks/factories/ThunkCompilerFactory'
import ThunkCacheManager from '@form-engine/core/ast/thunks/registries/ThunkCacheManager'
import { NodeCompilationPipeline } from '@form-engine/core/ast/compilation/NodeCompilationPipeline'
import RegistrationTraverser from '@form-engine/core/ast/registration/RegistrationTraverser'
import { NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { CompilationDependencies } from '@form-engine/core/ast/compilation/CompilationDependencies'
import { PseudoNodeFactory } from '@form-engine/core/ast/nodes/PseudoNodeFactory'
import { PseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import ThunkTypeMismatchError from '@form-engine/errors/ThunkTypeMismatchError'

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
  ) {}

  /**
   * Create runtime hooks for a specific node evaluation
   *
   * @param currentNodeId - The node currently being evaluated
   * @returns Runtime hooks object
   */
  create(currentNodeId: NodeId): RuntimeOverlayHooks {
    const builder = this.runtimeOverlayBuilder

    const createNode = (json: any): ASTNode => {
      return builder.nodeFactory.createNode(json)
    }

    const transformValue = (value: any): any => {
      return builder.nodeFactory.transformValue(value)
    }

    const registerRuntimeNode = (node: ASTNode, property: string): void => {
      // Simple single-node registration without dynamic code resolution
      // Use registerRuntimeNodesBatch for fields with dynamic codes
      NodeCompilationPipeline.normalize(node, this.compilationDependencies, NodeIDCategory.RUNTIME_AST)
      new RegistrationTraverser(this.compilationDependencies.nodeRegistry).register(node)

      this.compilationDependencies.metadataRegistry.set(node.id, 'attachedToParentNode', currentNodeId)
      this.compilationDependencies.metadataRegistry.set(node.id, 'attachedToParentProperty', property)
      NodeCompilationPipeline.setRuntimeMetadata(node, this.compilationDependencies)

      builder.runtimeNodes.set(node.id, node)

      // Create pseudo nodes and wire dependencies
      NodeCompilationPipeline.createPseudoNodes(this.compilationDependencies)
      NodeCompilationPipeline.wireDependencies(this.compilationDependencies)

      // Compile handler
      const compiledHandler = this.compiler.compileASTNode(node.id, node as any)
      builder.handlerRegistry.register(node.id, compiledHandler)

      // Invalidate caches
      this.cacheManager.invalidateCascading(node.id, builder.dependencyGraph)
    }

    const registerRuntimeNodesBatch = async (nodes: ASTNode[], property: string): Promise<void> => {
      if (nodes.length === 0) {
        return
      }

      const {
        deps: pendingCompilationDependencies,
        flush,
        getPendingNodeIds,
      } = this.compilationDependencies.createPendingView()

      // Phase 1: Normalize and register all nodes
      nodes.forEach(node => {
        NodeCompilationPipeline.normalize(node, pendingCompilationDependencies, NodeIDCategory.RUNTIME_AST)
        new RegistrationTraverser(pendingCompilationDependencies.nodeRegistry).register(node)

        pendingCompilationDependencies.metadataRegistry.set(node.id, 'attachedToParentNode', currentNodeId)
        pendingCompilationDependencies.metadataRegistry.set(node.id, 'attachedToParentProperty', property)
        NodeCompilationPipeline.setRuntimeMetadata(node, pendingCompilationDependencies)
      })

      // Add all registered nodes to the runtime nodes map
      const pendingIds = getPendingNodeIds()

      pendingIds
        .map(id => pendingCompilationDependencies.nodeRegistry.get(id))
        .forEach((runtimeNode: ASTNode) => {
          builder.runtimeNodes.set(runtimeNode.id, runtimeNode)
        })

      // Phase 2: Create pseudo nodes and wire dependencies ONCE for all nodes
      NodeCompilationPipeline.createPseudoNodes(pendingCompilationDependencies)
      NodeCompilationPipeline.wireDependencies(pendingCompilationDependencies)

      // Phase 3: Compile handlers for all newly registered nodes
      getPendingNodeIds().forEach(nodeId => {
        const registeredNode = pendingCompilationDependencies.nodeRegistry.get(nodeId)

        if (!registeredNode) {
          return
        }

        const compiledHandler = this.compiler.compileASTNode(nodeId, registeredNode as any)
        builder.handlerRegistry.register(nodeId, compiledHandler)
      })

      // Phase 4: Merge pending → main
      flush()

      // Phase 5: Invalidate caches
      nodes.forEach(node => {
        this.cacheManager.invalidateCascading(node.id, builder.dependencyGraph)
      })
    }

    const createPseudoNode = (type: PseudoNodeType, properties: Record<string, unknown>): PseudoNode => {
      // Create runtime pseudo node factory
      const runtimePseudoNodeFactory = new PseudoNodeFactory(
        this.compilationDependencies.nodeIdGenerator,
        NodeIDCategory.RUNTIME_PSEUDO,
      )

      // Create the pseudo node based on type
      switch (type) {
        case PseudoNodeType.ANSWER_REMOTE:
          return runtimePseudoNodeFactory.createAnswerRemotePseudoNode(properties.baseFieldCode as string)

        case PseudoNodeType.DATA:
          return runtimePseudoNodeFactory.createDataPseudoNode(properties.baseProperty as string)

        case PseudoNodeType.POST:
          return runtimePseudoNodeFactory.createPostPseudoNode(properties.baseFieldCode as string)

        case PseudoNodeType.QUERY:
          return runtimePseudoNodeFactory.createQueryPseudoNode(properties.paramName as string)

        case PseudoNodeType.PARAMS:
          return runtimePseudoNodeFactory.createParamsPseudoNode(properties.paramName as string)

        default:
          throw ThunkTypeMismatchError.invalidNodeType(currentNodeId, type, [
            PseudoNodeType.ANSWER_REMOTE,
            PseudoNodeType.DATA,
            PseudoNodeType.POST,
            PseudoNodeType.QUERY,
            PseudoNodeType.PARAMS,
          ])
      }
    }

    const registerPseudoNode = (pseudoNode: PseudoNode): void => {
      // Register pseudo node in the overlay registry
      builder.nodeRegistry.register(pseudoNode.id, pseudoNode)
      builder.runtimeNodes.set(pseudoNode.id, pseudoNode as any)

      // Compile and register handler for the pseudo node
      const handler = this.compiler.compileASTNode(pseudoNode.id, pseudoNode as any)
      builder.handlerRegistry.register(pseudoNode.id, handler)
    }

    return {
      createNode,
      transformValue,
      registerRuntimeNode,
      registerRuntimeNodesBatch,
      createPseudoNode,
      registerPseudoNode,
    }
  }
}
