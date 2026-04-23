import { NodeIDCategory, NodeIDGenerator } from './id-generators/NodeIDGenerator'
import { NodeFactory } from '../nodes/NodeFactory'
import NodeRegistry from './registries/NodeRegistry'
import ASTNodeTree from './node-tree/ASTNodeTree'

export class CompilationDependencies {
  constructor(
    readonly nodeIdGenerator = new NodeIDGenerator(),
    readonly nodeFactory = new NodeFactory(nodeIdGenerator, NodeIDCategory.COMPILE_AST),
    readonly nodeRegistry: NodeRegistry = new NodeRegistry(),
    readonly astNodeTree: ASTNodeTree = new ASTNodeTree(),
  ) {}

  clone() {
    const clonedNodeIdGenerator = this.nodeIdGenerator.clone()
    const clonedNodeFactory = new NodeFactory(clonedNodeIdGenerator, NodeIDCategory.COMPILE_AST)
    const clonedNodeRegistry = this.nodeRegistry.clone()
    const clonedAstNodeTree = this.astNodeTree.clone()

    return new CompilationDependencies(clonedNodeIdGenerator, clonedNodeFactory, clonedNodeRegistry, clonedAstNodeTree)
  }
}
