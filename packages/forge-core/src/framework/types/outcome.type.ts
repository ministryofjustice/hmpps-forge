import type { ComponentRegistry } from './adapter.type'
import type { RenderContext } from '../rendering/types'

export type ForgeErrorCode = 'node-not-found' | 'method-not-supported'

export interface ForgeError {
  readonly code: ForgeErrorCode
  readonly message: string
}

export type ForgeOutcome<TOut = undefined> =
  | {
      readonly kind: 'render'
      readonly context: RenderContext
      readonly componentRegistry: ComponentRegistry
      readonly output?: TOut
    }
  | { readonly kind: 'navigate'; readonly url: string }
  | { readonly kind: 'error'; readonly error: ForgeError }
