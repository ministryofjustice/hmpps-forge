# errors

Error classes thrown by the engine. Each error type corresponds to a specific
failure mode, and every class is exported from the package root, so callers can
`instanceof` their way from configuration problems to runtime evaluation
failures without parsing message strings.

| Error | Thrown when |
|-------|------------|
| [`ForgeConfigurationSchemaError`](./ForgeConfigurationSchemaError.ts) | An authored definition fails Zod schema validation |
| [`ForgeConfigurationReferenceScopeError`](./ForgeConfigurationReferenceScopeError.ts) | A reference (e.g. `Answer()`, `Params()`) is used in a scope where its data source isn't available |
| [`ForgeConfigurationSerialisationError`](./ForgeConfigurationSerialisationError.ts) | The authored input can't be serialised into a valid journey |
| [`ForgeCompilationError`](./ForgeCompilationError.ts) | Generated source can't be compiled into a function during codegen (`new Function`) |
| [`ForgeRuntimeEvaluationError`](./ForgeRuntimeEvaluationError.ts) | A compiled function throws at request time and carries diagnostic context such as node id and DSL path |
| [`InvalidNodeError`](./InvalidNodeError.ts) | An AST node has an unexpected shape or missing properties |
| [`UnknownNodeTypeError`](./UnknownNodeTypeError.ts) | `NodeFactory` encounters a type the creator table has no row for |
| [`DuplicateRouteError`](./DuplicateRouteError.ts) | Two steps or journeys declare the same route path |
| [`RegistryDuplicateError`](./RegistryDuplicateError.ts) | A function or component is registered with a name that already exists |
| [`RegistryValidationError`](./RegistryValidationError.ts) | A registry entry is malformed (e.g. missing `evaluate` or `variant`) |
| [`UnregisteredComponentError`](./UnregisteredComponentError.ts) | A block references a component variant that isn't in the registry |
| [`UnregisteredFunctionError`](./UnregisteredFunctionError.ts) | An expression references a function name that isn't in the registry |
| [`ForgeRegistrationError`](./ForgeRegistrationError.ts) | Package registration fails while `strictRegistration` is enabled |

Most engine errors keep their native stack traces. Runtime evaluation errors are
special because production loggers often serialize `stack`, so they append a
`Forge diagnostics:` block through
[`DiagnosticErrorFormatter`](../diagnostics/DiagnosticErrorFormatter.ts).

[`RegistrationErrorFormatter.ts`](./RegistrationErrorFormatter.ts) formats
registry error context for display.
