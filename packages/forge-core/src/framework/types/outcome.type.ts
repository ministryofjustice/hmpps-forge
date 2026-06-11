import type { ComponentRegistry } from './adapter.type'
import type { RenderContext } from '../rendering/types'

export type ForgeErrorCode = 'node-not-found' | 'method-not-supported'

export interface ForgeError {
  readonly code: ForgeErrorCode
  readonly message: string
}

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
