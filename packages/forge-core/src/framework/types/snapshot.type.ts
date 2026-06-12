import type { HttpMethod, RequestLocation } from './request.type'

/**
 * A plain, framework-agnostic description of a single request to evaluate.
 *
 * The adapter builds this from its native request (Express, Remix, a test
 * harness, a React store, …) and hands it to {@link Forge.evaluate}. The engine
 * never sees the native request — everything it needs to evaluate a step lives
 * here as serialisable data.
 */
export interface RequestSnapshot {
  /** Identifies which compiled node (step or journey root) to evaluate. Taken from {@link ForgeRoute.nodeId}. */
  readonly nodeId: string

  /** GET selects the view/enter pipeline; POST selects the submit pipeline. */
  readonly method: HttpMethod

  /** Origin, pathname and base path used to resolve relative redirect targets. */
  readonly location: RequestLocation

  readonly params: Record<string, string>
  readonly query: Record<string, string | string[]>
  readonly post: Record<string, unknown>
  readonly headers: Record<string, string | string[] | undefined>
  readonly cookies: Record<string, string | undefined>

  /** Adapter-managed request state (e.g. Express `res.locals`), readable by hooks. */
  readonly state: Record<string, unknown>

  /**
   * The session object. The engine reads it via `getSession()` and author code
   * may mutate it in place; the adapter is responsible for persisting it.
   */
  readonly session: unknown
}
