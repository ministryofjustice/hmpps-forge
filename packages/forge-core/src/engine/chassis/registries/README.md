# registries

Registries are lookup tables that map names to implementations. They're
populated at startup when a forge package is registered, and queried at both
compile time and request time.

| Registry | Stores | Used by |
|----------|--------|---------|
| [`FunctionRegistry`](./FunctionRegistry.ts) | Conditions, transformers, effects, and generators - by name. Each entry has an `evaluate` function and an `isAsync` flag | `lowering/` reads `isAsync` to decide sync vs async codegen; `runtime/` calls `evaluate` through the `_forgeHelpers` dispatch |
| [`ComponentRegistry`](./ComponentRegistry.ts) | UI component renderers - by variant name (e.g. `govuk-text-input`). Each entry has a `render` function that produces blocks | `runtime/` resolves components during rendering |
| [`ScopedFunctionRegistry`](./ScopedFunctionRegistry.ts) | A `FunctionRegistry` subclass scoped to one journey: `get`/`has` fall back to a parent registry, so journey-specific functions overlay the globally-registered ones. Exposed to compiled functions as `ctx.conditions` | Compiled functions call `ctx.conditions.get(name).evaluate(...)` |
| [`ScopedComponentRegistry`](./ScopedComponentRegistry.ts) | A `ComponentRegistry` subclass scoped to one journey: `get`/`has` fall back to a parent registry, so journey-specific components overlay the globally-registered ones | Threaded onto the mount node and into the runtime render phase, where `runtime/` looks up entries via `componentRegistry.get(variant)` and hands them to the renderer |
| [`MountRegistry`](./MountRegistry.ts) | `MountedNode` values - by mount key. `register()` builds the route tree and one mounted node per step and journey from a compiled `PackageInstance` | `Forge.execute()` calls `getNode()` to pick the node for a request; `getTopology()` gives framework adapters the routes to mount |

The function and component registries validate on registration. Bad entries
raise `ForgeRegistryValidationError` or `ForgeRegistryDuplicateError`, collected into an
`AggregateError`.
