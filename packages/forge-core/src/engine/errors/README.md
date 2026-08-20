# errors

Error classes thrown by the engine. Each error type corresponds to a specific
failure mode, and every class is exported from the package root, so callers can
`instanceof` their way from configuration problems to runtime evaluation
failures without parsing message strings.

Every class extends [`ForgeBaseError`](./ForgeBaseError.ts), which owns the
shared diagnostic fields (`formattedPath` - the human-readable path through the
journey DSL - and `callsite` - the captured author callsite), stamps `name`
from the concrete class, and trims constructor frames off the stack trace. A
single `instanceof ForgeBaseError` check answers "did Forge throw this".

| Error | Thrown when |
|-------|------------|
| [`ForgeAuthoringError`](./ForgeAuthoringError.ts) | The authoring API is misused while builders are still assembling the definition (e.g. a circular reference) |
| [`ForgeSchemaError`](./ForgeSchemaError.ts) | An authored definition fails Zod schema validation |
| [`ForgeReferenceScopeError`](./ForgeReferenceScopeError.ts) | A reference (e.g. `Answer()`, `Params()`) is used in a scope where its data source isn't available |
| [`ForgeSerialisationError`](./ForgeSerialisationError.ts) | The authored input can't be serialised into a valid journey |
| [`ForgeCompilationError`](./ForgeCompilationError.ts) | Generated source can't be compiled into a function during codegen (`new Function`) |
| [`ForgeRuntimeEvaluationError`](./ForgeRuntimeEvaluationError.ts) | A compiled function throws at request time and carries diagnostic context such as node id and DSL path |
| [`ForgeInvalidNodeError`](./ForgeInvalidNodeError.ts) | An AST node has an unexpected shape or missing properties |
| [`ForgeUnknownNodeTypeError`](./ForgeUnknownNodeTypeError.ts) | `NodeFactory` encounters a type the creator table has no row for |
| [`ForgeDuplicateRouteError`](./ForgeDuplicateRouteError.ts) | Two steps or journeys declare the same route path |
| [`ForgeRegistryDuplicateError`](./ForgeRegistryDuplicateError.ts) | A function or component is registered with a name that already exists |
| [`ForgeRegistryValidationError`](./ForgeRegistryValidationError.ts) | A registry entry is malformed (e.g. missing `evaluate` or `variant`) |
| [`ForgeUnregisteredComponentError`](./ForgeUnregisteredComponentError.ts) | A block references a component variant that isn't in the registry |
| [`ForgeUnregisteredFunctionError`](./ForgeUnregisteredFunctionError.ts) | An expression references a function name that isn't in the registry |
| [`ForgeFunctionArityError`](./ForgeFunctionArityError.ts) | An authored expression calls a registered function with the wrong number of arguments |
| [`ForgeRegistrationError`](./ForgeRegistrationError.ts) | Package registration fails while `strictRegistration` is enabled |
| [`ForgeInternalError`](./ForgeInternalError.ts) | An internal consistency check fails - a state the engine should make impossible, so reaching one is a bug in Forge |

Most engine errors keep their native stack traces. Runtime evaluation errors are
special because production loggers often serialize `stack`, so they append a
`Forge diagnostics:` block through
[`DiagnosticErrorFormatter`](./DiagnosticErrorFormatter.ts).

[`RegistrationErrorFormatter.ts`](./RegistrationErrorFormatter.ts) formats
registry error context for display.
