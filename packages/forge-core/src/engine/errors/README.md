# errors

Error classes thrown by the engine. Each error type corresponds to a specific
failure mode, so callers can distinguish configuration problems from runtime
evaluation failures without parsing message strings.

| Error | Thrown when |
|-------|------------|
| [`ForgeConfigurationSchemaError`](./ForgeConfigurationSchemaError.ts) | An authored definition fails Zod schema validation |
| [`ForgeConfigurationReferenceScopeError`](./ForgeConfigurationReferenceScopeError.ts) | A reference (e.g. `Answer()`, `Params()`) is used in a scope where its data source isn't available |
| [`ForgeConfigurationSerialisationError`](./ForgeConfigurationSerialisationError.ts) | The authored input can't be serialised into a valid journey |
| [`ForgeCompilationError`](./ForgeCompilationError.ts) | Something goes wrong during AST construction or codegen |
| [`ForgeRuntimeEvaluationError`](./ForgeRuntimeEvaluationError.ts) | A compiled function throws at request time - wraps the original error with diagnostic context (node id, DSL path) |
| [`InvalidNodeError`](./InvalidNodeError.ts) | An AST node has an unexpected shape or missing properties |
| [`UnknownNodeTypeError`](./UnknownNodeTypeError.ts) | `NodeFactory` encounters a type it has no factory for |
| [`DuplicateRouteError`](./DuplicateRouteError.ts) | Two steps or journeys declare the same route path |
| [`RegistryDuplicateError`](./RegistryDuplicateError.ts) | A function or component is registered with a name that already exists |
| [`RegistryValidationError`](./RegistryValidationError.ts) | A registry entry is malformed (e.g. missing `evaluate` or `variant`) |
| [`UnregisteredComponentError`](./UnregisteredComponentError.ts) | A block references a component variant that isn't in the registry |
| [`UnregisteredFunctionError`](./UnregisteredFunctionError.ts) | An expression references a function name that isn't in the registry |

[`formatDiagnosticStack.ts`](./formatDiagnosticStack.ts) and
[`RegistrationErrorFormatter.ts`](./RegistrationErrorFormatter.ts) format error
context for display.
