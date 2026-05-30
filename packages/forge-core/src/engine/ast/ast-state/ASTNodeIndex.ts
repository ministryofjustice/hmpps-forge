import { ASTNode, NodeId } from '../../contracts/ast/engine.type'
import { ASTNodeType } from '../../contracts/ast/enums'
import { BlockType, ExpressionType, FunctionType, HookType, PredicateType } from '../../../authoring/types/enums'
import { ExpressionASTNode } from '../../contracts/ast/expressions.type'
import { PredicateASTNode } from '../../contracts/ast/predicates.type'
import { BlockASTNode } from '../../contracts/ast/structures.type'

/** Indexes include both structural AST types and authoring sub-types. */
export type IndexableNodeType = ASTNodeType | ExpressionType | FunctionType | PredicateType | HookType | BlockType

/**
 * Stores the shared compiled AST by ID.
 *
 * The type index is deliberately simple because compilers ask broad questions:
 * "all FIELD blocks", "all ITERATE expressions", "all SUBMIT hooks". The AST
 * tree handles ownership and ancestry; this registry handles fast retrieval.
 */
export default class ASTNodeIndex {
  private readonly nodes: Map<NodeId, ASTNode> = new Map()

  private readonly typeIndex: Map<string, Set<NodeId>> = new Map()

  /**
   * Nodes are frozen on registration so every generated function sees the same
   * shared AST shape for the lifetime of the compiled journey.
   */
  register(id: NodeId, node: ASTNode): void {
    if (this.nodes.has(id)) {
      throw new Error(`Node with ID "${id}" is already registered`)
    }

    this.nodes.set(id, Object.freeze(node))

    this.addToTypeIndex(node.type, id)

    const subType = this.getNodeSubType(node)

    if (subType) {
      this.addToTypeIndex(subType, id)
    }
  }

  private addToTypeIndex(type: string, id: NodeId): void {
    let typeSet = this.typeIndex.get(type)

    if (!typeSet) {
      typeSet = new Set()
      this.typeIndex.set(type, typeSet)
    }

    typeSet.add(id)
  }

  /** Sub-type indexing keeps compiler queries independent of AST wrapper type. */
  private getNodeSubType(node: ASTNode): string | undefined {
    if ('expressionType' in node) {
      return (node as ExpressionASTNode).expressionType
    }

    if ('predicateType' in node) {
      return (node as PredicateASTNode).predicateType
    }

    if ('hookType' in node) {
      return (node as { hookType: HookType }).hookType
    }

    if ('blockType' in node) {
      return (node as BlockASTNode).blockType
    }

    return undefined
  }

  get(id: NodeId): ASTNode | undefined {
    return this.nodes.get(id)
  }

  has(id: NodeId): boolean {
    return this.nodes.has(id)
  }

  findByType<T = ASTNode>(type: IndexableNodeType): T[] {
    const nodeIds = this.typeIndex.get(type)

    if (!nodeIds) {
      return []
    }

    const results: T[] = []

    nodeIds.forEach(id => {
      const node = this.nodes.get(id)

      if (node) {
        results.push(node as T)
      }
    })

    return results
  }
}
