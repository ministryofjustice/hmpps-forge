import { NodeId, ASTNode } from '@form-engine/core/types/engine.type'
import { RuntimeOverlayBuilder, MetadataComputationDependencies } from '@form-engine/core/compilation/thunks/types'
import ThunkCompilerFactory from '@form-engine/core/compilation/thunks/ThunkCompilerFactory'
import { NodeCompilationPipeline } from '@form-engine/core/compilation/NodeCompilationPipeline'
import NodeRegistrationWalker from '@form-engine/core/compilation/traversers/NodeRegistrationWalker'
import { NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { CompilationDependencies } from '@form-engine/core/compilation/CompilationDependencies'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import { TemplateValue } from '@form-engine/core/types/template.type'
import TemplateFactory from '@form-engine/core/nodes/template/TemplateFactory'

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
 */
export default class ThunkRuntimeHooksFactory {
  constructor(
    private readonly compilationDependencies: CompilationDependencies,
    private readonly compiler: ThunkCompilerFactory,
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

    const instantiateTemplate = (template: TemplateValue): any => {
      return TemplateFactory.instantiate(template)
    }

    const registerRuntimeNodesBatch = (nodes: ASTNode[], property: string): void => {
      if (nodes.length === 0) {
        return
      }

      const { deps: pendingOverlay, flush, getPendingNodeIds } = this.compilationDependencies.createOverlay()

      const insideStep = this.compilationDependencies.metadataRegistry.get<boolean>(
        currentNodeId,
        'isDescendantOfStep',
        false,
      )

      const walker = new NodeRegistrationWalker(
        pendingOverlay.nodeIdGenerator,
        NodeIDCategory.RUNTIME_AST,
        pendingOverlay.nodeRegistry,
        pendingOverlay.nodeFactory,
        pendingOverlay.metadataRegistry,
        insideStep,
        pendingOverlay.astNodeTree,
      )

      nodes.forEach(node => {
        walker.register(node, currentNodeId, property)
      })

      // Add registered AST nodes to the runtime nodes map
      const astNodeIds = getPendingNodeIds()

      astNodeIds
        .map(id => pendingOverlay.nodeRegistry.get(id))
        .forEach((runtimeNode: ASTNode) => {
          runtimeOverlay.runtimeNodes.set(runtimeNode.id, runtimeNode)
        })

      // Create pseudo nodes (scan only pending nodes, not the full registry)
      NodeCompilationPipeline.createPseudoNodes(pendingOverlay, pendingOverlay.nodeRegistry.getPendingRegistry())

      const allPendingIds = getPendingNodeIds()

      // Compile handlers for all newly registered nodes
      allPendingIds.forEach(nodeId => {
        const registeredNode = pendingOverlay.nodeRegistry.get(nodeId)

        if (!registeredNode) {
          return
        }

        const compiledHandler = this.compiler.compileASTNode(nodeId, registeredNode)
        pendingOverlay.thunkHandlerRegistry.register(nodeId, compiledHandler)
      })

      // Compute isAsync metadata for hybrid handlers
      // Skip when the parent iterate handler's template is known-sync at compile time,
      // since all handlers default to isAsync = false and no async source exists in the template
      const isTemplateAsync = this.compilationDependencies.metadataRegistry.get<boolean>(
        currentNodeId,
        'isTemplateAsync',
        true,
      )

      if (isTemplateAsync) {
        const metadataDeps: MetadataComputationDependencies = {
          thunkHandlerRegistry: pendingOverlay.thunkHandlerRegistry,
          functionRegistry: this.functionRegistry,
          nodeRegistry: pendingOverlay.nodeRegistry,
          metadataRegistry: pendingOverlay.metadataRegistry,
          astNodeTree: pendingOverlay.astNodeTree,
        }

        const pendingPostOrder = pendingOverlay.astNodeTree.postOrder()
        const pendingTreeSet = new Set(pendingPostOrder)
        const pendingPseudoIds = allPendingIds.filter(id => !pendingTreeSet.has(id))
        const computeOrder = [...pendingPseudoIds, ...pendingPostOrder]

        computeOrder.forEach(nodeId => {
          const handler = pendingOverlay.thunkHandlerRegistry.get(nodeId)

          if (handler) {
            handler.computeIsAsync(metadataDeps)
          }
        })
      }

      // Merge pending → main
      flush()
    }

    return {
      instantiateTemplateValue: instantiateTemplate,
      transformValue,
      registerRuntimeNodesBatch,
    }
  }
}
