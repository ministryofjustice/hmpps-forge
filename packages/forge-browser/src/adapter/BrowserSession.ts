import type { BrowserStorage } from './types'

export interface BrowserSessionOptions {
  /** Where to persist the session between page loads - typically `sessionStorage`. Omit for in-memory only. */
  readonly storage?: BrowserStorage
  /** @default 'forge-browser-session' */
  readonly storageKey?: string
}

/**
 * The adapter-owned session object. The engine only passes the reference
 * through to author effects, which mutate it in place - `persist()` runs after
 * every `execute()` so those writes survive a page reload when storage is
 * available. Storage is best-effort: unavailable or invalid storage falls
 * back to the live in-memory state. Seeded with an `id`, which journey effects
 * commonly key their stores on.
 */
export default class BrowserSession {
  private constructor(
    private readonly state: Record<string, unknown>,
    private readonly storage: BrowserStorage | undefined,
    private readonly storageKey: string,
  ) {}

  static create(options: BrowserSessionOptions = {}): BrowserSession {
    const storageKey = options.storageKey ?? 'forge-browser-session'
    const restored = BrowserSession.restore(options.storage, storageKey)
    const state = restored ?? { id: crypto.randomUUID() }

    return new BrowserSession(state, options.storage, storageKey)
  }

  /** The live mutable session object handed to every snapshot. */
  getState(): Record<string, unknown> {
    return this.state
  }

  persist(): void {
    if (!this.storage) {
      return
    }

    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.state))
    } catch {
      // Storage can be blocked or full; the live session remains usable in memory.
    }
  }

  private static restore(storage: BrowserStorage | undefined, storageKey: string): Record<string, unknown> | undefined {
    if (!storage) {
      return undefined
    }

    try {
      const stored = storage.getItem(storageKey)

      if (stored === null) {
        return undefined
      }

      const state: unknown = JSON.parse(stored)

      return BrowserSession.isSessionState(state) ? state : undefined
    } catch {
      return undefined
    }
  }

  private static isSessionState(state: unknown): state is Record<string, unknown> {
    return typeof state === 'object' && state !== null && !Array.isArray(state)
  }
}
