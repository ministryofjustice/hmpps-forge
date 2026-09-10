import type {
  ForgeOutcome,
  ForgeRenderer,
  ForgeTopology,
  RequestSnapshot,
  ResponseBindings,
} from '@ministryofjustice/hmpps-forge/core/framework'

/**
 * The execution surface the adapter needs from a Forge instance with registered packages.
 */
export interface BrowserForge {
  getTopology(): ForgeTopology
  execute(request: {
    adapterDependencies?: object
    snapshot: RequestSnapshot
    responseBindings?: ResponseBindings
    renderer?: ForgeRenderer<unknown>
  }): Promise<ForgeOutcome<unknown>>
}

/** The canonical location value supplied by a browser host. */
export interface BrowserLocationSnapshot {
  readonly href: string
}

/** A document scroll position captured against one browser history entry. */
export interface BrowserScrollPosition {
  readonly x: number
  readonly y: number
}

/** The destination applied after newly rendered content is in the document. */
export type BrowserScrollTarget =
  | { readonly kind: 'fragment'; readonly fragment: string }
  | { readonly kind: 'position'; readonly position: BrowserScrollPosition }

/**
 * One intercepted user interaction, produced by the host:
 * - `submit` - a form post inside the container, with its field values
 * - `follow` - a link click inside the container
 * - `restore` - a history navigation (back/forward), rendered without pushing
 *
 * `url` is normalized to the same-origin pathname, query, and fragment.
 */
export type BrowserInteraction =
  | { readonly kind: 'submit'; readonly url: string; readonly body: Record<string, unknown> }
  | { readonly kind: 'follow'; readonly url: string }
  | { readonly kind: 'restore'; readonly url: string; readonly scrollPosition?: BrowserScrollPosition }

/**
 * The window seam. `WindowBrowserHost` implements it over the real
 * window/history; tests supply a fake. Everything the adapter knows about the
 * browser arrives through this interface.
 */
export interface BrowserHost {
  getLocation(): BrowserLocationSnapshot
  pushUrl(url: string): void
  replaceUrl(url: string): void
  /** Hard navigation - used when a redirect leaves the mounted journeys. */
  assign(url: string): void
  /** Commit a visual update, optionally through a same-document view transition. */
  updateView?(update: () => Promise<void> | void): Promise<void> | void
  /** Apply navigation scrolling after the destination has been rendered. */
  scrollTo?(target: BrowserScrollTarget): void
  /** Subscribe to user interactions. Returns the unsubscribe function. */
  subscribe(listener: (interaction: BrowserInteraction) => void): () => void
}

/** The render target - structurally an element, but only the swap surface is needed. */
export interface ForgeContainer {
  innerHTML: string
}

/** Structural `sessionStorage`/`localStorage` surface for session persistence. */
export interface BrowserStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
