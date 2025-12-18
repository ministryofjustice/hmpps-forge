import { ThunkHandler, SyncThunkHandler, AsyncThunkHandler, HybridThunkHandler } from './types'

/**
 * Type guard to check if handler is synchronous (or hybrid with isAsync=false)
 *
 * Returns true for:
 * - Pure SyncThunkHandler (only has evaluateSync)
 * - HybridThunkHandler with isAsync=false (can use evaluateSync)
 *
 * @param handler - The handler to check
 * @returns True if handler can be evaluated synchronously
 */
export function isSyncHandler(handler: ThunkHandler): handler is SyncThunkHandler | HybridThunkHandler {
  if ('isAsync' in handler) {
    return handler.isAsync === false
  }

  return 'evaluateSync' in handler && !('evaluate' in handler)
}

/**
 * Type guard to check if handler is asynchronous (or hybrid with isAsync=true)
 *
 * Returns true for:
 * - Pure AsyncThunkHandler (only has evaluate)
 * - HybridThunkHandler with isAsync=true (must use evaluate)
 *
 * @param handler - The handler to check
 * @returns True if handler requires async evaluation
 */
export function isAsyncHandler(handler: ThunkHandler): handler is AsyncThunkHandler | HybridThunkHandler {
  if ('isAsync' in handler) {
    return handler.isAsync === true
  }

  return 'evaluate' in handler && !('evaluateSync' in handler)
}

/**
 * Type guard to check if handler is hybrid (implements both sync and async)
 *
 * @param handler - The handler to check
 * @returns True if handler implements HybridThunkHandler (has computeIsAsync method)
 */
export function isHybridHandler(handler: ThunkHandler): handler is HybridThunkHandler {
  return 'computeIsAsync' in handler
}
