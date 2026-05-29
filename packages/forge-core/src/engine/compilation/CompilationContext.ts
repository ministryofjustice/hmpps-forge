import { NodeIDCategory, NodeIDGenerator } from './id-generators/NodeIDGenerator'
import { NodeFactory } from './nodes/NodeFactory'
import NodeRegistry from './registries/NodeRegistry'
import ASTNodeTree from './node-tree/ASTNodeTree'

export class CompilationContext {
  constructor(
    readonly nodeIdGenerator = new NodeIDGenerator(),
    readonly nodeFactory = new NodeFactory(nodeIdGenerator, NodeIDCategory.COMPILE_AST),
    readonly nodeRegistry: NodeRegistry = new NodeRegistry(),
    readonly astNodeTree: ASTNodeTree = new ASTNodeTree(),
  ) {}
}
