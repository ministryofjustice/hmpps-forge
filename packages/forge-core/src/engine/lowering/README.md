# lowering - codegen

Lowering is the engine's code generator. The name comes from compiler
terminology - "lowering" means translating from a higher-level representation
(the AST) to a lower-level one (executable JavaScript). It walks the frozen AST
and **writes JavaScript as a string**, then compiles that string with
`new Function`. The functions it produces are what
[`runtime/`](../runtime/README.md) executes later - lowering never runs them
itself.

## Why code generation?

The engine could interpret the AST directly - walk and dispatch every node on
every request - but this leads to pretty awful performance. Journeys can easily have
thousands of nodes, with 10s of levels deep of JSON. Instead, lowering pays that
cost once at startup: it emits JavaScript source, compiles it with `new Function`,
and from then on the generated functions run at V8-native speed.
A journey with dozens of steps and hundreds of expressions compiles in milliseconds
and never re-parses. Under the heaviest of load, V8 will also optimize these functions
internally to improve performance further.

## Watch it compile one field

An author adds a single text field that trims its input:

```ts
field({ code: 'name', formatters: [Transformer.String.Trim()] })
```

The [`ast/`](../ast/README.md) layer turns that into a node - a
`FieldBlockASTNode` whose formatter is
`{ id: "compile_ast:1", expressionType: "FunctionType.Transformer", name: "Trim" }`.

Compilation happens in three steps:

1. [`CompilationPlanner`](./CompilationPlanner.ts) walks the AST and produces a
   `CompilationPlan` - per-step/journey inputs, reachability plans, field
   inventories. No code emitted yet.
2. [`CodegenOrchestrator.compileAll(plan, nodeRegistry)`](./CodegenOrchestrator.ts)
   drives the phase compilers. Navigation compiles first, because it attaches
   per-step validation functions to the shared `NavigationRuntimePlan` that
   `compileStep` reuses (commented at
   [`CodegenOrchestrator.ts:21`](./CodegenOrchestrator.ts)).
3. [`createCompiledFunction`](./function-construction/compiledFunctionFactory.ts)
   turns each emitted source string into a real function, choosing `Function` or
   `AsyncFunction`.

For our field, the answer-preparation compiler produces this (trimmed - the real
output also wraps the formatter in a `TypeError`-tolerant `try/catch`, and
prefixes each comment with the full class name):

```js
(ctx, _forgeHelpers) => {
  "use strict";
  const isPost = ctx.request.method === "POST";
  if (isPost) {
    // --- compilePostPath ---
    const answerHistory = _forgeHelpers.ensureAnswerHistory(ctx, "name");
    let rawValue = _forgeHelpers.normalizePostValue(ctx.post["name"], false);
    _forgeHelpers.pushAnswerMutation(answerHistory, rawValue, "post");
    let formattedValue = rawValue;

    // --- compileFormatterPipeline ---   (the Trim() formatter)
    const formatterResult = _forgeHelpers.evaluateFunction(ctx, _forgeRuntimeDiagnostics,
      { nodeId: "compile_ast:1", functionName: "Trim", functionType: "FunctionType.Transformer" },
      "Trim", [formattedValue]);
    if (formatterResult !== undefined) {
      formattedValue = formatterResult;
    }
    if (formattedValue !== rawValue) {
      _forgeHelpers.pushAnswerMutation(answerHistory, formattedValue, "processed");
    }
  } else {
    // --- compileGetPath ---   (GET: keep the saved answer, else fall back to defaultValue)
    let answerHistory = ctx.answers["name"];
    if (!(answerHistory && answerHistory.current !== undefined)) {
      answerHistory = _forgeHelpers.ensureAnswerHistory(ctx, "name");
      _forgeHelpers.pushAnswerMutation(answerHistory, undefined, "default");
    }
  }
}
```

What happened:

- **`(ctx, _forgeHelpers)`** - the generated function closes over nothing. Every
  dependency arrives as a parameter: `ctx` is the request-scoped state, and
  `_forgeHelpers` is the runtime helper library the emitted code calls into (so
  the generated string stays small, and the hard logic stays in real, testable
  functions). This is what lets a compiled function cross into `runtime/` as an
  opaque value. (`_forgeRuntimeDiagnostics` is an optional extra parameter,
  which is why it's referenced defensively.)
- **The `// --- … ---` comments are emitted by the compiler.** Every block is
  stamped with the method that wrote it (e.g.
  `StepAnswerPreparationCompiler.compilePostPath`). When you're reading or
  logging the generated source, these tell you which compiler method produced
  each section.
- **`ensureAnswerHistory → normalizePostValue → pushAnswerMutation(…, "post")`,
  then `(…, "processed")`** - an answer isn't a bare value, it's a mutation log.
  Each change is tagged with a source (`"post"`, `"processed"`, `"default"`),
  which is how the engine can explain where an answer came from for the answer
  mutation history.
- **`evaluateFunction(…, { nodeId: "compile_ast:1", functionName: "Trim" }, …)`**
  - the author's `Trim()` formatter became a call through `_forgeHelpers`,
  wrapped with the node's id. That `compile_ast:1` is the exact id the
  [`ast/`](../ast/README.md) layer stamped on the formatter node - the
  breadcrumb that lets a runtime error point back at what the author wrote.
- **Async is discovered, not declared.**
  [`ExpressionDispatcher`](./expressions/ExpressionDispatcher.ts) tracks a
  `usesAwait` flag as it compiles; if any function it calls is async, the whole
  generated function is built with `AsyncFunction`. Hooks always force async,
  because effect calls are always awaited.

Every other compiler follows the same pattern. There is one per output function:

| Compiled by | Output | Does, at request time |
|---|---|---|
| `StepRenderCompiler` | `CompiledRenderFunction` | build the render blocks + step/ancestor metadata |
| `StepValidationCompiler` | `CompiledValidationFunction` / `CompiledEntryValidationFunction` | run validation / pick entry-validation groups |
| `StepAnswerPreparationCompiler` | `CompiledAnswerPreparationFunction` | format submitted answers into state *(shown above)* |
| `HookLifecycleCompiler` | `CompiledAccessLifecycleFunction` / `CompiledSubmitHooksFunction` | run access / submit hooks + effects |
| `ReachabilityCompiler` | `CompiledReachabilityFunction` / `CompiledNavigationFunction` | evaluate reachability + navigation |

All output types are declared in [`contracts/`](../contracts), never here.

## Key files

| File | Role |
|------|------|
| [`CompilationPlanner.ts`](./CompilationPlanner.ts) | AST → `CompilationPlan` (the pre-analysis pass) |
| [`CodegenOrchestrator.ts`](./CodegenOrchestrator.ts) | Drives all phase compilers; `compileAll` is the entry point |
| [`expressions/ExpressionDispatcher.ts`](./expressions/ExpressionDispatcher.ts) | Routes every expression node to its compiler; owns iterator frames, `@self` scope, `usesAwait`, local-var counter |
| [`emitters/`](./emitters/) | `CodeEmitter` (source builder), `DiagnosticEmitter` (node-id metadata wrapping), `FieldCodeEmitter` (field-code expressions) |
| [`function-construction/`](./function-construction/) | `GeneratedFunctionHelpers` (the `_forgeHelpers` library), `GeneratedFunctionCompiler` (source wrapping), `createCompiledFunction` (the only `new Function` site) |
| [`phase-compilers/`](./phase-compilers/) | One compiler per output function (see table above) |
| [`structures/`](./structures/) | `RuntimeValueCompiler` (materialises authored values), `ScopedTemplateCompiler` (iterator/template loop codegen, shared across phases) |

`lowering/` may depend on `ast/` and `contracts/`, never on `runtime/` -
enforced by eslint, so a stray import fails the build.
