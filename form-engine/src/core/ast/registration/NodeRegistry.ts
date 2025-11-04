import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { ASTNodeType } from '@form-engine/core/types/enums'

/**
 * Metadata stored for each registered node
 */
export interface NodeRegistryEntry {
  node: ASTNode
  path: (string | number)[]
}

/**
 * Registry for storing and retrieving AST nodes by their unique IDs.
 */
export default class NodeRegistry {
  private readonly nodes: Map<NodeId, NodeRegistryEntry> = new Map()

  /**
   * Register a node with its ID and path
   * @param id The unique ID for the node
   * @param node The AST node to register
   * @param path The structural path from root to this node
   * @throws Error if ID is already registered
   */
  register(id: NodeId, node: ASTNode, path: (string | number)[] = []): void {
    if (this.nodes.has(id)) {
      throw new Error(`Node with ID "${id}" is already registered`)
    }

    this.nodes.set(id, { node, path })
  }

  /**
   * Get a node by its ID
   * @param id The ID of the node to retrieve
   * @returns The node, or undefined if not found
   */
  get(id: NodeId): ASTNode | undefined {
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
  getAll(): Map<NodeId, ASTNode> {
    const result = new Map<NodeId, ASTNode>()

    for (const [id, entry] of this.nodes) {
      result.set(id, entry.node)
    }

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
  findByType(type: ASTNodeType): ASTNode[] {
    const results: ASTNode[] = []

    for (const entry of this.nodes.values()) {
      if (entry.node.type === type) {
        results.push(entry.node)
      }
    }

    return results
  }

  /**
   * Find nodes by a custom predicate
   * @param predicate Function to test each node
   * @returns Array of nodes matching the predicate
   */
  findBy(predicate: (node: ASTNode) => boolean): ASTNode[] {
    const results: ASTNode[] = []

    for (const entry of this.nodes.values()) {
      if (predicate(entry.node)) {
        results.push(entry.node)
      }
    }

    return results
  }
}
