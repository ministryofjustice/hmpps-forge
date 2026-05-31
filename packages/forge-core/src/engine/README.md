# The Forge engine

The engine is a compiler. An author writes a journey as plain definitions
(steps, blocks, expressions, hooks); the engine turns those definitions into
JavaScript functions and runs those functions to serve HTTP requests.

These docs are for people working **on the engine**. They name internal types
freely. If you're building a journey, you want the author docs instead.

## The pipeline

```
  authoring definitions  (journey / step / block / expression objects)
          │
          ▼
  ast/        build the AST          definitions  ──▶  frozen ASTNode tree
          │
          ▼
  lowering/   codegen                ASTNode tree ──▶  compiled JS functions
          │
          ▼
  runtime/    execution              compiled fns + HTTP request ──▶  response

  contracts/  the shared type vocabulary every layer above speaks
```

| Layer | What it does | README |
|-------|--------------|--------|
| `contracts/` | Declares the types that cross layer boundaries - no logic | [`contracts/`](./contracts/README.md) |
| `ast/` | Normalises author definitions into a frozen, id'd node tree | [`ast/`](./ast/README.md) |
| `lowering/` | Generates JavaScript source from the AST, compiles it with `new Function` | [`lowering/`](./lowering/README.md) |
| `runtime/` | Runs compiled functions per HTTP request, returns a render or redirect | [`runtime/`](./runtime/README.md) |

## Layer boundaries

The layer separation is enforced by eslint (`import/no-restricted-paths` in
`packages/eslint.config.mjs`). A stray import fails the build.

```
  contracts/   depends on nothing in the engine
  ast/         may depend on  contracts/
  lowering/    may depend on  contracts/ + ast/
  runtime/     may depend on  contracts/        (NOT ast/, NOT lowering/)
```

Tests and `testing-helpers/` are exempt.

## Cross-cutting directories

These sit outside the pipeline but are used across it:

| Directory | What it does | README |
|-----------|--------------|--------|
| `registries/` | Lookup tables for functions and components, populated at startup | [`registries/`](./registries/README.md) |
| `validation/` | Schema + rule checks on the authored definition before it reaches the AST | [`validation/`](./validation/README.md) |
| `errors/` | Error classes for each failure mode (configuration, compilation, runtime) | [`errors/`](./errors/README.md) |
| `diagnostics/` | Source location metadata and DSL path formatting for error messages | [`diagnostics/`](./diagnostics/README.md) |

## Where to start reading

- **Follow a journey from definition to running code:** read the layer READMEs
  top to bottom - `ast/` → `lowering/` → `runtime/`.
- **Follow a single HTTP request:** start at
  [`runtime/routes/ForgeRouter.ts`](./runtime/routes/ForgeRouter.ts).
- **Follow compilation:** start at
  [`lowering/CompilationPlanner.ts`](./lowering/CompilationPlanner.ts).
