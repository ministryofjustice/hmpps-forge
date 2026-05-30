import type { ComponentRegistry } from './adapter.type'
import type { CookieMutation } from './response.type'
import type { RenderContext } from '../rendering/types'

/**
 * Response side-effects recorded during evaluation. The adapter flushes these
 * onto its native response before dispatching the outcome.
 */
export interface ForgeEffects {
  readonly headers: Map<string, string>
  readonly cookies: Map<string, CookieMutation>
}

export type ForgeErrorCode = 'node-not-found' | 'method-not-supported'

/**
 * A control-flow error surfaced as a value (not thrown). The adapter maps the
 * {@link ForgeErrorCode} onto its framework's error path — an HTTP status, an
 * error boundary, an exit code, etc.
 */
export interface ForgeError {
  readonly code: ForgeErrorCode
  readonly message: string
}

/**
 * The result of evaluating a {@link RequestSnapshot}.
 *
 * Pure data the adapter dispatches: render a page, navigate elsewhere, or
 * surface an error. The engine never decides how any of these reach the wire.
 */
export type ForgeOutcome =
  | {
      readonly kind: 'render'
      readonly context: RenderContext
      readonly componentRegistry: ComponentRegistry
      readonly effects: ForgeEffects
    }
  | { readonly kind: 'navigate'; readonly url: string; readonly effects: ForgeEffects }
  | { readonly kind: 'error'; readonly error: ForgeError; readonly effects: ForgeEffects }
