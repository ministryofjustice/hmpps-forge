import { NodeId } from '@form-engine/core/types/engine.type'

/**
 * Registry for storing arbitrary compilation-specific metadata about nodes
 * This is a generic key-value store that allows storing any metadata without
 * modifying the registry class or mutating frozen nodes
 */
export default class MetadataRegistry {
  private readonly metadata: Map<NodeId, Record<string, unknown>> = new Map()

  /**
   * Set a metadata property for a node
   * @param nodeId The node ID
   * @param key The metadata property name
   * @param value The metadata value
   */
  set(nodeId: NodeId, key: string, value: unknown): void {
    if (!this.metadata.has(nodeId)) {
      this.metadata.set(nodeId, {})
    }

    this.metadata.get(nodeId)![key] = value
  }

  /**
   * Get a metadata property for a node
   * @param nodeId The node ID
   * @param key The metadata property name
   * @param defaultValue Optional default value if property doesn't exist
   * @returns The metadata value or default
   */
  get<T = unknown>(nodeId: NodeId, key: string, defaultValue?: T): T {
    return (this.metadata.get(nodeId)?.[key] as T) ?? (defaultValue as T)
  }

  /**
   * Check if a node has a specific metadata property
   * @param nodeId The node ID
   * @param key The metadata property name
   * @returns True if the property exists
   */
  has(nodeId: NodeId, key: string): boolean {
    return this.metadata.get(nodeId)?.[key] !== undefined
  }

  /**
   * Get all metadata for a node
   * @param nodeId The node ID
   * @returns All metadata properties for the node, or empty object
   */
  getAll(nodeId: NodeId): Record<string, unknown> {
    return this.metadata.get(nodeId) ?? {}
  }

  /**
   * Delete a specific metadata property for a node
   * @param nodeId The node ID
   * @param key The metadata property name
   */
  delete(nodeId: NodeId, key: string): void {
    const nodeMetadata = this.metadata.get(nodeId)

    if (nodeMetadata) {
      delete nodeMetadata[key]
    }
  }

  /**
   * Delete all metadata for a node
   * @param nodeId The node ID
   */
  deleteAll(nodeId: NodeId): void {
    this.metadata.delete(nodeId)
  }

  /**
   * Get all entries in the registry
   * @returns Map of all node IDs to their metadata maps
   */
  getAllEntries(): Map<NodeId, Map<string, unknown>> {
    const result = new Map<NodeId, Map<string, unknown>>()

    this.metadata.forEach((meta, nodeId) => {
      const metaMap = new Map<string, unknown>()

      Object.entries(meta).forEach(([key, value]) => {
        metaMap.set(key, value)
      })

      result.set(nodeId, metaMap)
    })

    return result
  }

  /**
   * Clear all metadata
   */
  clear(): void {
    this.metadata.clear()
  }

  /**
   * Create a shallow copy of this metadata registry
   * The clone can be modified independently per compilation
   * @returns A new MetadataRegistry with the same metadata
   */
  clone(): MetadataRegistry {
    const cloned = new MetadataRegistry()

    this.metadata.forEach((meta, nodeId) => {
      cloned.metadata.set(nodeId, { ...meta })
    })

    return cloned
  }
}
