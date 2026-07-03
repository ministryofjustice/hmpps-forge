# diagnostics

Diagnostics translate authored DSL positions into stable error context.

AST construction writes source information directly onto nodes:

```ts
node.diagnostics.source.path
node.diagnostics.source.formattedPath
```

There is no side-channel source map and no hidden symbol metadata.

| File | What it does |
|------|--------------|
| [`sourceLocation.type.ts`](./sourceLocation.type.ts) | Shared contracts for DSL path segments, source locations, and AST node diagnostics |
| [`DSLPathFormatter.ts`](./DSLPathFormatter.ts) | Turns a raw path segment array into a human-readable DSL path by resolving journey, step, block, function, and iterator context |
| [`DSLSourceLocator.ts`](./DSLSourceLocator.ts) | Combines a root authored object with `DSLPathFormatter` to create `DSLSourceLocation` values |
| [`DiagnosticErrorFormatter.ts`](./DiagnosticErrorFormatter.ts) | Formats diagnostic fields for error display and appends runtime diagnostic blocks to stack traces |
| [`ForgeTraceSinkDispatcher.ts`](./ForgeTraceSinkDispatcher.ts) | Fans request trace events out to configured instrumentation sinks; `enabled` is true only when at least one sink is registered |
