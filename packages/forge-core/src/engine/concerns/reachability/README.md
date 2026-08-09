# reachability

Reachability decides which steps a user can be on, and where to send them when they ask for one they cannot reach.
It splits into two compiled halves. The facts function evaluates the journey's authored reachability expressions -
entry predicates, forward outcomes, tie-breakers, the resume condition - against the current request. The state
function then walks the journey graph over those facts and projects the reachable set, the canonical path, the
frontier, and the resume outcome. Runtime turns that projection into a redirect decision or lets the request
continue.

## Stage folders

- [analysis](analysis/README.md) builds the reachability state table, the richer compilation plan, and the field inventory sources.
- [lowering](lowering/README.md) emits the facts function; its `graph/` folder holds the static walk that becomes the state function.
- [runtime](runtime/README.md) runs both compiled functions and resolves redirects and backlinks.
- `contracts` holds `reachabilityEvaluation.type.ts`, `generatedReachabilityEvaluation.type.ts`, and `journeyReachabilityProjection.type.ts`.

## Runtime phase

This concern owns `request.reachability`. It runs on journey and step requests alike, and it is where journey
requests stop - a journey has no page of its own, so it always redirects to a reachable step. The phase creates no
child work tasks.

## Cross-concern edges

- Reachability imports **validation** to read the validity filter, because forward movement can be validation-gated.
- Reachability imports **answer-cleardown** for `StepFieldInventoryCompiler` and the inventory type, which it emits into its own facts function.
- Reachability imports **route** for `JourneyRouteTemplateCatalog`, used to turn reachable step ids into route-template paths.
- **resolve** imports reachability for the backlink and redirect helpers and the evaluation type.
- **answer-cleardown** imports reachability for `JourneyReachabilityProjection`.

Reachability sits at the centre of the concern graph, so it is the concern most worth keeping honest. The zones
are in [eslint.config.mjs](../../../../eslint.config.mjs).
