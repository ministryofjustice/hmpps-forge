export type RouteMethod = 'GET' | 'POST'

/**
 * A single registrable route, derived by the engine from the compiled journey.
 *
 * Adapters consume these to wire routes into their framework however they like
 * (Express routers, Remix route modules, a client-side dispatch table, …). The
 * engine owns route *derivation*; the adapter owns route *registration*.
 */
export interface ForgeRoute {
  /** Pass this back on the {@link RequestSnapshot} to evaluate this node. */
  readonly nodeId: string

  readonly kind: 'step' | 'journey'

  /** Full path template including base path and `:param` placeholders, e.g. `/forms/order/:id/details`. */
  readonly templatePath: string

  /** The owning journey's base path template, used to resolve relative redirects. */
  readonly basePath: string

  /** Steps accept GET (view) and POST (submit); journey roots accept GET (enter). */
  readonly methods: RouteMethod[]

  readonly title?: string
}

/** The full set of routes a registered set of journeys exposes. */
export interface ForgeTopology {
  readonly routes: ForgeRoute[]
}
