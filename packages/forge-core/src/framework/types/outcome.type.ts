import type { RenderContext } from '../rendering/types'

/**
 * Error raised by a journey's lifecycle hooks. The status is the HTTP status
 * code declared in the journey configuration. Route and method matching is the
 * adapter's responsibility, so a hook error is the only error the engine produces.
 */
export interface ForgeHookError {
  readonly status: number
  readonly message: string
}

export type ForgeError = ForgeHookError

export type ForgeOutcome<TOut = undefined> =
  | {
      readonly kind: 'render'
      readonly context: RenderContext
      readonly output?: TOut
    }
  | { readonly kind: 'navigate'; readonly url: string }
  | { readonly kind: 'error'; readonly error: ForgeError }
