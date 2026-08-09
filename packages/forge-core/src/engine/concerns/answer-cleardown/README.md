# answer-cleardown

Answer cleardown removes answers that belong to steps no reachable path can still reach. When a user changes an
earlier answer, the steps that answer used to unlock can drop out of the reachable set, and the answers they
collected should stop feeding validation, hooks, and render. Cleardown mutates those answer histories in place
with a `cleardown` mutation rather than deleting the keys, so traces still show that the answer existed.

## Stage folders

- [analysis](analysis/README.md) builds the per-step field inventory sources from the journey's reachability plan.
- [runtime](runtime/README.md) owns the cleardown algorithm and the `request.answer-cleardown` phase handler.
- `lowering` holds `StepFieldInventoryCompiler`, which emits the per-step field inventory cleardown matches against.
- `contracts` holds `stepFieldInventory.type.ts` and `compiledFieldInventory.type.ts`.

The concern's compile-time half is the field inventory, compiled into its own artifact
(`compiledFieldInventory`) and mounted alongside the reachability functions. The reachability phase evaluates it
on step requests, because the inventory needs the request params that only step requests carry, and hands the
result to the reachability state function, which projects it per step.

## Runtime phase

This concern owns `request.answer-cleardown`, which runs on step requests only, after reachability and before
entry validation or submit. It creates no child work tasks - the phase handler calls `evaluateAnswerCleardown()`
directly.

## Cross-concern edges

- Answer cleardown imports **reachability** for `JourneyReachabilityProjection`, the projection that says which steps are unreachable.
- **Reachability** imports answer cleardown for the `StepFieldInventory` type, which its state input carries and its projector reads.

Both edges follow the inventory: cleardown reads the projection reachability builds, and reachability names the
inventory type it is handed. Every other concern edge is blocked by the zones in
[eslint.config.mjs](../../../../eslint.config.mjs).
