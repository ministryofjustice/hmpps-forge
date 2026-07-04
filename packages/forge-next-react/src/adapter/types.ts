import type { ResponseBindings } from '@ministryofjustice/hmpps-forge/core/framework'

export type MaybePromise<T> = T | Promise<T>

export type RouteParamValue = string | string[] | undefined

export interface NextRouteContext {
  params?: MaybePromise<Record<string, RouteParamValue>>
}

/**
 * Adapter-managed session persistence for a Forge request.
 *
 * `save` receives the same {@link ResponseBindings} sink the engine hooks wrote
 * through, so a cookie-issuing store has one deterministic write path per flow.
 * The route-handler flow passes a recording sink whose cookies are applied to the
 * returned `Response`; the action flow passes a `cookies()`-backed sink writing
 * through `next/headers`; the page flow passes a no-op sink, so cookie writes are
 * dropped during a page render.
 */
export interface NextForgeSessionStore {
  load(request: Request): MaybePromise<unknown>
  save(session: unknown, request: Request, bindings: ResponseBindings): MaybePromise<void>
}
