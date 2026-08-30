# registries

Registries and catalogs are lookup tables that map names to function metadata.
Function definitions are catalogued at package registration;
executable function registries are built during request context preparation.

| Registry | Stores | Used by |
|----------|--------|---------|
| [`FunctionDefinitionCatalog`](./FunctionDefinitionCatalog.ts) | Unbound condition, transformer, effect, generator, and render metadata - by name | Registration validation and compilation |
| [`FunctionRegistry`](./FunctionRegistry.ts) | Request-bound conditions, transformers, effects, generators, and renders - by name. Each entry has an `evaluate` function | Generated code and render work invoke the request-bound evaluators |
| [`MountRegistry`](./MountRegistry.ts) | `MountedNode` values - by mount key. `register()` builds the route tree and one mounted node per step and journey from a compiled `PackageInstance` | `Forge.execute()` calls `getNode()` to pick the node for a request; `getTopology()` gives framework adapters the routes to mount |

Each package owns its function builders and `packageDependencies`. An adapter can
add stable `adapterDependencies` and lazy `requestDependencies` for one request.
Each request owns one ordinary function registry built from all three dependency
sources. There is no global registry or parent fallback.

Function definitions and request rows validate on registration. Bad entries
raise `ForgeRegistryValidationError` or `ForgeRegistryDuplicateError`, collected into an
`AggregateError`.
