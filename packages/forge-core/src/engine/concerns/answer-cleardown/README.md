# answer-cleardown

Answer cleardown removes answers that belong to steps no reachable path can still reach. When a user changes an
earlier answer, the steps that answer used to unlock can drop out of the reachable set, and the answers they
collected should stop feeding validation, hooks, and render. Cleardown mutates those answer histories in place
with a `cleardown` mutation rather than deleting the keys, so traces still show that the answer existed.

## Stage folders

- [runtime](runtime/README.md) owns the cleardown algorithm and the `request.answer-cleardown` phase handler.
- `lowering` holds `StepFieldInventoryCompiler`, which emits the per-step field inventory cleardown matches against.
- `contracts` holds `stepFieldInventory.type.ts`.

This concern has an unusual shape. Its compile-time half is the field inventory, but that inventory has no
compiled artifact of its own: `StepFieldInventoryCompiler` emits straight into
[reachability's compiled facts function](../reachability/lowering/README.md) through `compileInto`, because
reachability is the function that already walks every step and already carries the request params the inventory
needs. There is also no `analysis` folder - the inventory sources are built by reachability's analyzer alongside
the reachability entries. Round two gives cleardown its own compiled artifact and its own analyzer; until then the
lowering folder is a compiler that another concern calls.

## Runtime phase

This concern owns `request.answer-cleardown`, which runs on step requests only, after reachability and before
entry validation or submit. It creates no child work tasks - the phase handler calls `evaluateAnswerCleardown()`
directly.

## Cross-concern edges

- Answer cleardown imports **reachability** for `JourneyReachabilityProjection`, the projection that says which steps are unreachable.
- **Reachability** imports answer cleardown for `StepFieldInventoryCompiler` and the inventory type.

That pair of edges is the cost of the shared compiled function described above. Every other concern edge is
blocked by the zones in [eslint.config.mjs](../../../../eslint.config.mjs).
