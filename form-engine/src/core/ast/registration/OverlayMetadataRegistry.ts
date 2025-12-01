import { NodeId } from '@form-engine/core/types/engine.type'
import MetadataRegistry from './MetadataRegistry'

/**
 * Overlay metadata registry that delegates to main and pending registries.
 * - New metadata goes to pending
 * - Lookups check pending first, then main
 */
export default class OverlayMetadataRegistry extends MetadataRegistry {
  constructor(
    private readonly main: MetadataRegistry,
    private readonly pending = new MetadataRegistry(),
  ) {
    super()
  }

  set(nodeId: NodeId, key: string, value: unknown): void {
    this.pending.set(nodeId, key, value)
  }

  get<T = unknown>(nodeId: NodeId, key: string, defaultValue?: T): T {
    if (this.pending.has(nodeId, key)) {
      return this.pending.get<T>(nodeId, key, defaultValue)
    }

    return this.main.get<T>(nodeId, key, defaultValue)
  }

  has(nodeId: NodeId, key: string): boolean {
    return this.pending.has(nodeId, key) || this.main.has(nodeId, key)
  }

  getAll(nodeId: NodeId): Record<string, unknown> {
    return {
      ...this.main.getAll(nodeId),
      ...this.pending.getAll(nodeId),
    }
  }

  delete(nodeId: NodeId, key: string): void {
    if (this.pending.has(nodeId, key)) {
      this.pending.delete(nodeId, key)
      return
    }

    this.main.delete(nodeId, key)
  }

  deleteAll(nodeId: NodeId): void {
    this.pending.deleteAll(nodeId)
    this.main.deleteAll(nodeId)
  }

  getAllEntries(): Map<NodeId, Map<string, unknown>> {
    const mainEntries = this.main.getAllEntries()
    const pendingEntries = this.pending.getAllEntries()
    const merged = new Map<NodeId, Map<string, unknown>>()

    mainEntries.forEach((meta, nodeId) => {
      merged.set(nodeId, new Map(meta))
    })

    pendingEntries.forEach((meta, nodeId) => {
      if (merged.has(nodeId)) {
        meta.forEach((value, key) => merged.get(nodeId)!.set(key, value))
      } else {
        merged.set(nodeId, new Map(meta))
      }
    })

    return merged
  }

  clear(): void {
    this.clearPending()
  }

  clearPending(): void {
    this.pending.clear()
  }

  clone(): MetadataRegistry {
    throw new Error('Cannot clone an OverlayMetadataRegistry - clone the main registry instead')
  }

  flushIntoMain(): void {
    this.pending.getAllEntries().forEach((meta, nodeId) => {
      meta.forEach((value, key) => this.main.set(nodeId, key, value))
    })

    this.clearPending()
  }
}
