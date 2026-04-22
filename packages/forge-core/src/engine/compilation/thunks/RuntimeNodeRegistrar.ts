import { ASTNode, NodeId } from '../../types/ast.type'
import FunctionRegistry from '../../registries/FunctionRegistry'
import { CompilationDependencies } from '../CompilationDependencies'
import ThunkCompilerFactory from './ThunkCompilerFactory'
import { NodeCompilationPipeline } from '../NodeCompilationPipeline'
import NodeRegistrationWalker from '../traversers/NodeRegistrationWalker'
import { NodeIDCategory } from '../id-generators/NodeIDGenerator'
import { MetadataComputationDependencies } from './types'
import { isASTNode } from '../../typeguards/nodes'

export default class RuntimeNodeRegistrar {
  private readonly compiler: ThunkCompilerFactory

  constructor(
    private readonly compilationDependencies: CompilationDependencies,
    private readonly functionRegistry: FunctionRegistry,
    private readonly runtimeNodes?: Map<NodeId, ASTNode>,
    compiler = new ThunkCompilerFactory(),
  ) {
    this.compiler = compiler
  }

  registerBatch(currentNodeId: NodeId, nodes: ASTNode[], property: string): NodeId[] {
    if (nodes.length === 0) {
      return []
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
      pendingOverlay.metadataRegistry,
      insideStep,
      pendingOverlay.astNodeTree,
    )

    nodes.forEach(node => {
      walker.register(node, currentNodeId, property)
    })

    const astNodeIds = getPendingNodeIds()

    if (this.runtimeNodes) {
      astNodeIds
        .map(nodeId => pendingOverlay.nodeRegistry.get(nodeId))
        .filter(isASTNode)
        .forEach(runtimeNode => {
          this.runtimeNodes?.set(runtimeNode.id, runtimeNode)
        })
    }

    NodeCompilationPipeline.createPseudoNodes(pendingOverlay, pendingOverlay.nodeRegistry.getPendingRegistry())

    const allPendingIds = getPendingNodeIds()

    allPendingIds.forEach(nodeId => {
      const registeredNode = pendingOverlay.nodeRegistry.get(nodeId)

      if (!registeredNode) {
        return
      }

      const compiledHandler = this.compiler.compileASTNode(nodeId, registeredNode)

      pendingOverlay.thunkHandlerRegistry.register(nodeId, compiledHandler)
    })

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
      const pendingPseudoIds = allPendingIds.filter(nodeId => !pendingTreeSet.has(nodeId))
      const computeOrder = [...pendingPseudoIds, ...pendingPostOrder]

      computeOrder.forEach(nodeId => {
        const handler = pendingOverlay.thunkHandlerRegistry.get(nodeId)

        if (handler) {
          handler.computeIsAsync(metadataDeps)
        }
      })
    }

    flush()

    return allPendingIds
  }
}
