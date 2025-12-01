import { NodeId } from '@form-engine/core/types/engine.type'
import { ThunkHandler } from '@form-engine/core/ast/thunks/types'
import ThunkHandlerRegistryError from '@form-engine/errors/ThunkHandlerRegistryError'

/**
 * Registry for storing and retrieving thunk handlers by their NodeId.
 *
 * Provides O(1) lookup performance for handler dispatch during evaluation.
 * Follows the same pattern as NodeRegistry for consistency.
 */
export default class ThunkHandlerRegistry {
  private readonly handlers: Map<NodeId, ThunkHandler> = new Map()

  /**
   * Register a handler for a specific node
   *
   * @param nodeId - The unique ID of the node this handler evaluates
   * @param handler - The ThunkHandler implementation
   * @throws Error if a handler is already registered for this nodeId
   */
  register(nodeId: NodeId, handler: ThunkHandler): void {
    if (this.handlers.has(nodeId)) {
      const existingHandler = this.handlers.get(nodeId)!
      throw ThunkHandlerRegistryError.duplicate(nodeId, existingHandler.constructor.name, handler.constructor.name)
    }

    this.handlers.set(nodeId, handler)
  }

  /**
   * Get a handler by its node ID
   *
   * @param nodeId - The ID of the node to get the handler for
   * @returns The handler, or undefined if not found
   */
  get(nodeId: NodeId): ThunkHandler | undefined {
    return this.handlers.get(nodeId)
  }

  /**
   * Check if a handler exists for the given node ID
   *
   * @param nodeId - The ID to check
   * @returns True if a handler is registered, false otherwise
   */
  has(nodeId: NodeId): boolean {
    return this.handlers.has(nodeId)
  }

  /**
   * Get all registered handlers
   *
   * @returns Map of all handlers by NodeId
   */
  getAll(): Map<NodeId, ThunkHandler> {
    return new Map(this.handlers)
  }

  /**
   * Get all registered node IDs
   *
   * @returns Array of all NodeIds with registered handlers
   */
  getIds(): NodeId[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * Get the number of registered handlers
   *
   * @returns The count of registered handlers
   */
  size(): number {
    return this.handlers.size
  }

  /**
   * Create a shallow copy of this registry
   *
   * Handler references are shared (safe since handlers are immutable),
   * but the registry map can be mutated independently.
   */
  clone(): ThunkHandlerRegistry {
    const cloned = new ThunkHandlerRegistry()

    this.handlers.forEach((handler, nodeId) => {
      cloned.register(nodeId, handler)
    })

    return cloned
  }
}
