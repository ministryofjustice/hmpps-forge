# route

Route owns everything about where a request is and where it can go. Route topology - segments, template paths,
parent and child links, node IDs - is built once at mount from the compiled route indexes. Titles, descriptions,
and metadata are authored as expressions, so they cannot live on that static tree; they compile into one
package-level function that runs per request and merges onto the topology by node ID. This concern also resolves
redirect target strings into concrete URLs once some other phase has decided to redirect.

## Stage folders

- [analysis](analysis/README.md) collects the authored `title`, `description`, and `metadata` from every step and journey.
- [lowering](lowering/README.md) emits the package-level `CompiledRouteMetadataFunction`.
- [runtime](runtime/README.md) builds the route tree at mount, hydrates it per request, and resolves redirect targets.
- `contracts` holds `routeDescriptors.type.ts` and `routeTree.type.ts`.

## Runtime phase

This concern owns `request.route-tree`, which runs on step requests just before resolve. It creates no child work
tasks. Its other two runtime jobs sit outside the phase list: `RouteTreeBuilder` runs at mount, and
`resolveRedirectTarget()` runs from `RequestPipeline` after any phase has chosen to redirect.

## Cross-concern edges

- Route imports no other concern.
- **reachability** imports route for `JourneyRouteTemplateCatalog`.

Route descriptors are also read by the compilation chassis, which builds the route indexes in
`CompilationPipeline`. That is not a concern edge - the chassis may read any concern's contracts. The zones are in
[eslint.config.mjs](../../../../eslint.config.mjs).
