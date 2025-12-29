import { NodeId } from '@form-engine/core/types/engine.type'
import { ThunkHandler } from '@form-engine/core/ast/thunks/types'
import ThunkHandlerRegistryError from '@form-engine/errors/ThunkHandlerRegistryError'
import ThunkHandlerRegistry from './ThunkHandlerRegistry'

/**
 * Overlay handler registry that delegates to main and pending registries.
 * - New registrations go to pending
 * - Lookups check pending first, then main
 * - Used for runtime node registration without cloning the entire handler registry
 */
export default class OverlayThunkHandlerRegistry extends ThunkHandlerRegistry {
  constructor(
    private readonly main: ThunkHandlerRegistry,
    private readonly pending = new ThunkHandlerRegistry(),
  ) {
    super()
  }

  register(nodeId: NodeId, handler: ThunkHandler): void {
    // Check BOTH for duplicates
    if (this.main.has(nodeId) || this.pending.has(nodeId)) {
      const existing = this.pending.get(nodeId) ?? this.main.get(nodeId)
      throw ThunkHandlerRegistryError.duplicate(nodeId, existing!.constructor.name, handler.constructor.name)
    }

    this.pending.register(nodeId, handler)
  }

  get(nodeId: NodeId): ThunkHandler | undefined {
    return this.pending.get(nodeId) ?? this.main.get(nodeId)
  }

  has(nodeId: NodeId): boolean {
    return this.pending.has(nodeId) || this.main.has(nodeId)
  }

  getAll(): Map<NodeId, ThunkHandler> {
    const merged = new Map<NodeId, ThunkHandler>()

    this.main.getAll().forEach((handler, id) => merged.set(id, handler))
    this.pending.getAll().forEach((handler, id) => merged.set(id, handler))

    return merged
  }

  getIds(): NodeId[] {
    return [...new Set([...this.main.getIds(), ...this.pending.getIds()])]
  }

  size(): number {
    return this.getIds().length
  }

  clone(): ThunkHandlerRegistry {
    throw new Error('Cannot clone an OverlayThunkHandlerRegistry - clone the main registry instead')
  }

  flushIntoMain(): void {
    this.pending.getAll().forEach((handler, id) => {
      this.main.register(id, handler)
    })

    this.pending.clear()
  }

  getPendingIds(): NodeId[] {
    return this.pending.getIds()
  }
}
