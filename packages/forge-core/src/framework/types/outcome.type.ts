import type { ComponentRegistry } from './adapter.type'
import type { RenderContext } from '../rendering/types'

export type ForgeErrorCode = 'node-not-found' | 'method-not-supported'

/** Engine-detected request error; host adapters map the code onto their transport's status. */
export interface ForgeEngineError {
  readonly code: ForgeErrorCode
  readonly message: string
}

/**
 * Error raised by a journey's lifecycle hooks. The status is the HTTP status
 * code declared in the journey configuration (500 when the hook did not
 * declare one).
 */
export interface ForgeHookError {
  readonly status: number
  readonly message: string
}

export type ForgeError = ForgeEngineError | ForgeHookError

/**
 * `TOut` is the bound renderer's output type (e.g. `string` for Nunjucks); a
 * Forge constructed without a renderer defaults it to `undefined` and render
 * outcomes are context-only.
 */
export type ForgeOutcome<TOut = undefined> =
  | {
      readonly kind: 'render'
      readonly context: RenderContext
      readonly componentRegistry: ComponentRegistry
      /** The assembled page from the bound renderer. */
      readonly output: TOut
      /** Top-level block outputs in render order, for consumers that compose their own page. */
      readonly renderedBlocks: readonly TOut[]
    }
  | { readonly kind: 'navigate'; readonly url: string }
  | { readonly kind: 'error'; readonly error: ForgeError }
