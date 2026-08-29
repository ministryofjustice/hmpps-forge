# registries

Registries are lookup tables that map names to implementations. They're
populated at startup when a forge package is registered, and queried at both
compile time and request time.

| Registry | Stores | Used by |
|----------|--------|---------|
| [`FunctionRegistry`](./FunctionRegistry.ts) | Conditions, transformers, effects, and generators - by name. Each entry has an `evaluate` function | Generated code calls `evaluate` through `_forgeHelpers`, checks the returned value, and awaits only when it is thenable |
| [`ComponentRegistry`](./ComponentRegistry.ts) | UI component renderers - by variant name (e.g. `govuk-text-input`). Each entry has a `render` function that produces blocks | `runtime/` resolves components during rendering |
| [`MountRegistry`](./MountRegistry.ts) | `MountedNode` values - by mount key. `register()` builds the route tree and one mounted node per step and journey from a compiled `PackageInstance` | `Forge.execute()` calls `getNode()` to pick the node for a request; `getTopology()` gives framework adapters the routes to mount |

Each package owns an ordinary function registry and component registry. There
is no global registry or parent fallback.

The function and component registries validate on registration. Bad entries
raise `ForgeRegistryValidationError` or `ForgeRegistryDuplicateError`, collected into an
`AggregateError`.
