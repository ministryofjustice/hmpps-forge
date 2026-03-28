import { NodeId } from '@form-engine/core/types/engine.type'
import ThunkBaseError from './ThunkBaseError'

export default class ThunkHandlerRegistryError extends ThunkBaseError {
  static notFound(nodeId: NodeId, registrySize: number, availableHandlers?: string[]): ThunkHandlerRegistryError {
    const available = availableHandlers?.length
      ? availableHandlers.slice(0, 5).join(', ') + (availableHandlers.length > 5 ? '...' : '')
      : undefined

    return new ThunkHandlerRegistryError('HANDLER_REGISTRY', nodeId, `No handler registered for node "${nodeId}"`, {
      'Registry Size': registrySize,
      'Available Handlers': available,
    })
  }

  static duplicate(nodeId: NodeId, existingHandlerType: string, newHandlerType: string): ThunkHandlerRegistryError {
    return new ThunkHandlerRegistryError(
      'HANDLER_REGISTRY',
      nodeId,
      `Handler for node "${nodeId}" is already registered (existing: ${existingHandlerType}, new: ${newHandlerType})`,
      {
        'Existing Handler': existingHandlerType,
        'New Handler': newHandlerType,
      },
    )
  }
}
