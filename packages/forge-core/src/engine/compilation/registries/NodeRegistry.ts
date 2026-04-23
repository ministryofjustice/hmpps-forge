import { ASTNode, NodeId } from '../../types/engine.type'
import { ASTNodeType } from '../../types/enums'
import { BlockType, ExpressionType, FunctionType, HookType, PredicateType } from '../../../authoring/types/enums'
import { ExpressionASTNode } from '../../types/expressions.type'
import { PredicateASTNode } from '../../types/predicates.type'
import { BlockASTNode } from '../../types/structures.type'

/** Indexes include both structural AST types and authoring sub-types. */
export type IndexableNodeType = ASTNodeType | ExpressionType | FunctionType | PredicateType | HookType | BlockType

/** Registered nodes keep their authoring path so generated failures can be traced. */
export interface NodeRegistryEntry {
  node: ASTNode
  path: (string | number)[]
}

/**
 * Stores the shared compiled AST by ID.
 *
 * The type index is deliberately simple because compilers ask broad questions:
 * "all FIELD blocks", "all ITERATE expressions", "all SUBMIT hooks". The AST
 * tree handles ownership and ancestry; this registry handles fast retrieval.
 */
export default class NodeRegistry {
  private readonly nodes: Map<NodeId, NodeRegistryEntry> = new Map()

  private readonly typeIndex: Map<string, Set<NodeId>> = new Map()

  /**
   * Nodes are frozen on registration so every generated function sees the same
   * shared AST shape for the lifetime of the compiled journey.
   */
  register(id: NodeId, node: ASTNode, path: (string | number)[] = []): void {
    if (this.nodes.has(id)) {
      throw new Error(`Node with ID "${id}" is already registered`)
    }

    this.nodes.set(id, { node: Object.freeze(node), path })

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
    return this.nodes.get(id)?.node
  }

  /** Get the registered node plus its authoring path, when available. */
  getEntry(id: NodeId): NodeRegistryEntry | undefined {
    return this.nodes.get(id)
  }

  has(id: NodeId): boolean {
    return this.nodes.has(id)
  }

  getAll(): Map<NodeId, ASTNode> {
    const result = new Map<NodeId, ASTNode>()

    this.nodes.forEach((entry, id) => {
      result.set(id, entry.node)
    })

    return result
  }

  getAllEntries(): Map<NodeId, NodeRegistryEntry> {
    return new Map(this.nodes)
  }

  getIds(): NodeId[] {
    return Array.from(this.nodes.keys())
  }

  size(): number {
    return this.nodes.size
  }

  findByType<T = ASTNode>(type: IndexableNodeType): T[] {
    const nodeIds = this.typeIndex.get(type)

    if (!nodeIds) {
      return []
    }

    const results: T[] = []

    nodeIds.forEach(id => {
      const entry = this.nodes.get(id)

      if (entry) {
        results.push(entry.node as T)
      }
    })

    return results
  }

  findBy(predicate: (node: ASTNode) => boolean): ASTNode[] {
    const results: ASTNode[] = []

    this.nodes.forEach(entry => {
      if (predicate(entry.node)) {
        results.push(entry.node)
      }
    })

    return results
  }

  clear(): void {
    this.nodes.clear()
    this.typeIndex.clear()
  }

  /**
   * Copies share frozen node objects but own their indices, which lets compiler
   * artefacts fork without mutating the original registry bookkeeping.
   */
  clone(): NodeRegistry {
    const cloned = Object.create(Object.getPrototypeOf(this)) as NodeRegistry

    const clonedIndex = new Map<string, Set<NodeId>>()

    this.typeIndex.forEach((nodeSet, type) => {
      clonedIndex.set(type, new Set(nodeSet))
    })

    return Object.assign(cloned, {
      nodes: new Map(this.nodes),
      typeIndex: clonedIndex,
    })
  }
}
