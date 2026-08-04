import type { RenderContext } from './rendering.type'

/**
 * Error returned in a Forge error outcome. Its optional status and statusCode
 * properties are hints for framework adapters.
 */
export interface ForgeError extends Error {
  readonly status?: number
  readonly statusCode?: number
}

export type ForgeOutcome<TOut = undefined> =
  | {
      readonly kind: 'render'
      readonly context: RenderContext
      readonly output?: TOut
    }
  | { readonly kind: 'navigate'; readonly url: string }
  | { readonly kind: 'error'; readonly error: ForgeError }
