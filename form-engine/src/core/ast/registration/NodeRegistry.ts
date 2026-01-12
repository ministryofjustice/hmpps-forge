import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { BlockType, ExpressionType, FunctionType, PredicateType, TransitionType } from '@form-engine/form/types/enums'
import { PseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { ExpressionASTNode } from '@form-engine/core/types/expressions.type'
import { PredicateASTNode } from '@form-engine/core/types/predicates.type'
import { BlockASTNode } from '@form-engine/core/types/structures.type'

/**
 * Union type of all indexable node types
 * Includes top-level types (ASTNodeType, PseudoNodeType) and sub-types
 */
export type IndexableNodeType =
  | ASTNodeType
  | PseudoNodeType
  | ExpressionType
  | FunctionType
  | PredicateType
  | TransitionType
  | BlockType

/**
 * Metadata stored for each registered node
 */
export interface NodeRegistryEntry {
  node: ASTNode | PseudoNode
  path: (string | number)[]
}

/**
 * Registry for storing and retrieving AST nodes by their unique IDs.
 * Maintains a type index for O(1) lookups by type or sub-type.
 */
export default class NodeRegistry {
  private readonly nodes: Map<NodeId, NodeRegistryEntry> = new Map()

  /**
   * Type index for O(1) lookups by type or sub-type
   * Keys are type enum values (e.g., 'AstNode.Expression', 'ExpressionType.Reference')
   */
  private readonly typeIndex: Map<string, Set<NodeId>> = new Map()

  /**
   * Register a node with its ID and path
   * @param id The unique ID for the node
   * @param node The AST node to register
   * @param path The structural path from root to this node
   * @throws Error if ID is already registered
   */
  register(id: NodeId, node: ASTNode | PseudoNode, path: (string | number)[] = []): void {
    if (this.nodes.has(id)) {
      throw new Error(`Node with ID "${id}" is already registered`)
    }

    this.nodes.set(id, { node: Object.freeze(node), path })

    // Index by primary type
    this.addToTypeIndex(node.type, id)

    // Index by sub-type if present
    const subType = this.getNodeSubType(node)

    if (subType) {
      this.addToTypeIndex(subType, id)
    }
  }

  /**
   * Add a node ID to the type index
   */
  private addToTypeIndex(type: string, id: NodeId): void {
    let typeSet = this.typeIndex.get(type)

    if (!typeSet) {
      typeSet = new Set()
      this.typeIndex.set(type, typeSet)
    }

    typeSet.add(id)
  }

  /**
   * Extract the sub-type from a node if it has one
   */
  private getNodeSubType(node: ASTNode | PseudoNode): string | undefined {
    if ('expressionType' in node) {
      return (node as ExpressionASTNode).expressionType
    }

    if ('predicateType' in node) {
      return (node as PredicateASTNode).predicateType
    }

    if ('transitionType' in node) {
      return (node as { transitionType: TransitionType }).transitionType
    }

    if ('blockType' in node) {
      return (node as BlockASTNode).blockType
    }

    return undefined
  }

  /**
   * Get a node by its ID
   * @param id The ID of the node to retrieve
   * @returns The node, or undefined if not found
   */
  get(id: NodeId): ASTNode | PseudoNode | undefined {
    return this.nodes.get(id)?.node
  }

  /**
   * Get a node with its metadata by ID
   * @param id The ID of the node to retrieve
   * @returns The node entry with path, or undefined if not found
   */
  getEntry(id: NodeId): NodeRegistryEntry | undefined {
    return this.nodes.get(id)
  }

  /**
   * Check if a node with the given ID exists
   * @param id The ID to check
   * @returns True if the ID is registered, false otherwise
   */
  has(id: NodeId): boolean {
    return this.nodes.has(id)
  }

  /**
   * Get all registered nodes
   * @returns Map of all nodes by ID
   */
  getAll(): Map<NodeId, ASTNode | PseudoNode> {
    const result = new Map<NodeId, ASTNode | PseudoNode>()

    this.nodes.forEach((entry, id) => {
      result.set(id, entry.node)
    })

    return result
  }

  /**
   * Get all registered entries (nodes with paths)
   * @returns Map of all entries by ID
   */
  getAllEntries(): Map<NodeId, NodeRegistryEntry> {
    return new Map(this.nodes)
  }

  /**
   * Get all registered node IDs
   * @returns Array of all registered IDs
   */
  getIds(): NodeId[] {
    return Array.from(this.nodes.keys())
  }

  /**
   * Get the number of registered nodes
   * @returns The count of registered nodes
   */
  size(): number {
    return this.nodes.size
  }

  /**
   * Find nodes by type or sub-type using O(1) index lookup
   * @param type The node type to search for (top-level or sub-type)
   * @returns Array of nodes matching the type
   */
  findByType<T = ASTNode | PseudoNode>(type: IndexableNodeType): T[] {
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

  /**
   * Find nodes by a custom predicate
   * @param predicate Function to test each node
   * @returns Array of nodes matching the predicate
   */
  findBy(predicate: (node: ASTNode | PseudoNode) => boolean): (ASTNode | PseudoNode)[] {
    const results: (ASTNode | PseudoNode)[] = []

    this.nodes.forEach(entry => {
      if (predicate(entry.node)) {
        results.push(entry.node)
      }
    })

    return results
  }

  /**
   * Clear all registered nodes
   */
  clear(): void {
    this.nodes.clear()
    this.typeIndex.clear()
  }

  /**
   * Create a shallow copy of this registry
   * Node references are shared (safe since nodes are immutable),
   * but the registry can be modified independently
   * @returns A new NodeRegistry with the same entries
   */
  clone(): NodeRegistry {
    const cloned = Object.create(Object.getPrototypeOf(this)) as NodeRegistry

    // Clone the type index (deep copy of nested sets)
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
