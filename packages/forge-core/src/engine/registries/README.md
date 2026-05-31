# registries

Registries are lookup tables that map names to implementations. They're
populated at startup when a forge package is registered, and queried at both
compile time and request time.

| Registry | Stores | Used by |
|----------|--------|---------|
| [`FunctionRegistry`](./FunctionRegistry.ts) | Conditions, transformers, effects, and generators - by name. Each entry has an `evaluate` function and an `isAsync` flag | `lowering/` reads `isAsync` to decide sync vs async codegen; `runtime/` calls `evaluate` through the `_forgeHelpers` dispatch |
| [`ComponentRegistry`](./ComponentRegistry.ts) | UI component renderers - by variant name (e.g. `govuk-text-input`). Each entry has a `render` function that produces blocks | `runtime/` resolves components during rendering |
| [`ScopedFunctionRegistry`](./ScopedFunctionRegistry.ts) | A read-only view of `FunctionRegistry` exposed to compiled functions as `ctx.conditions` | Compiled functions call `ctx.conditions.get(name).evaluate(...)` |
| [`ScopedComponentRegistry`](./ScopedComponentRegistry.ts) | A read-only view of `ComponentRegistry` | Framework adapter uses it when applying render results |

Both registries validate on registration and throw `RegistryDuplicateError` or
`RegistryValidationError` for bad entries.
