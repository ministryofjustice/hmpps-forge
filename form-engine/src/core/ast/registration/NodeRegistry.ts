import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { PseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { isPseudoNode } from '@form-engine/core/typeguards/nodes'
import { getPseudoNodeKey } from './pseudoNodeKeyExtractor'

/**
 * Metadata stored for each registered node
 */
export interface NodeRegistryEntry {
  node: ASTNode | PseudoNode
  path: (string | number)[]
}

/**
 * Registry for storing and retrieving AST nodes by their unique IDs.
 */
export default class NodeRegistry {
  private readonly nodes: Map<NodeId, NodeRegistryEntry> = new Map()

  /**
   * Secondary index for O(1) pseudo node lookups
   * Map<PseudoNodeType, Map<key, NodeId>>
   */
  private readonly pseudoNodeIndex: Map<PseudoNodeType, Map<string, NodeId>> = new Map()

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

    // Update pseudo node index for O(1) lookups
    if (isPseudoNode(node)) {
      this.indexPseudoNode(id, node)
    }
  }

  /**
   * Index a pseudo node for O(1) lookup by type and key
   */
  private indexPseudoNode(id: NodeId, node: PseudoNode): void {
    const key = getPseudoNodeKey(node)

    if (key === undefined) {
      return
    }

    let typeIndex = this.pseudoNodeIndex.get(node.type)

    if (!typeIndex) {
      typeIndex = new Map()
      this.pseudoNodeIndex.set(node.type, typeIndex)
    }

    typeIndex.set(key, id)
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
   * Find nodes by type
   * @param type The node type symbol to search for
   * @returns Array of nodes matching the type
   */
  findByType<T = ASTNode | PseudoNode>(type: ASTNodeType | PseudoNodeType): T[] {
    const results: T[] = []

    this.nodes.forEach(entry => {
      if (entry.node.type === type) {
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
   * Find a pseudo node by type and key in O(1) time
   *
   * @param type The pseudo node type
   * @param key The lookup key (baseProperty, baseFieldCode, or paramName depending on type)
   * @returns The pseudo node, or undefined if not found
   */
  findPseudoNode<T extends PseudoNode = PseudoNode>(type: PseudoNodeType, key: string): T | undefined {
    const typeIndex = this.pseudoNodeIndex.get(type)

    if (!typeIndex) {
      return undefined
    }

    const nodeId = typeIndex.get(key)

    if (!nodeId) {
      return undefined
    }

    return this.get(nodeId) as T | undefined
  }

  /**
   * Find a pseudo node by key, checking multiple types in order
   * Used when a lookup could match different pseudo node types (e.g., ANSWER_LOCAL or ANSWER_REMOTE)
   *
   * @param types Array of pseudo node types to check (in order)
   * @param key The lookup key
   * @returns The first matching pseudo node, or undefined if none found
   */
  findPseudoNodeByTypes<T extends PseudoNode = PseudoNode>(types: PseudoNodeType[], key: string): T | undefined {
    for (const type of types) {
      const node = this.findPseudoNode<T>(type, key)

      if (node) {
        return node
      }
    }

    return undefined
  }

  /**
   * Clear all registered nodes
   */
  clear(): void {
    this.nodes.clear()
    this.pseudoNodeIndex.clear()
  }

  /**
   * Create a shallow copy of this registry
   * Node references are shared (safe since nodes are immutable),
   * but the registry can be modified independently
   * @returns A new NodeRegistry with the same entries
   */
  clone(): NodeRegistry {
    const cloned = Object.create(Object.getPrototypeOf(this)) as NodeRegistry

    // Clone the pseudo node index (deep copy of nested maps)
    const clonedIndex = new Map<PseudoNodeType, Map<string, NodeId>>()

    this.pseudoNodeIndex.forEach((typeIndex, type) => {
      clonedIndex.set(type, new Map(typeIndex))
    })

    return Object.assign(cloned, {
      nodes: new Map(this.nodes),
      pseudoNodeIndex: clonedIndex,
    })
  }
}
