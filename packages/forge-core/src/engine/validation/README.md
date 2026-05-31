# validation

Validation checks the author's journey definition *before* it reaches the AST or
the compiler. It catches mistakes early - missing fields, invalid schemas,
references to unregistered functions or components - so the error message can
point at what the author wrote, not at a compiler crash.

Two passes, both driven by [`DSLValidator`](./DSLValidator.ts):

1. **Schema validation** - [`schemas/`](./schemas/) defines Zod schemas for
   structures, expressions, and predicates. `DSLValidator.validateSchema` runs
   the authored input against them.
2. **Rule validation** - [`walkAndValidate`](./walkAndValidate.ts) walks the
   authored tree and runs each rule in [`rules/`](./rules/) against every node.
   Rules check things like: are referenced functions registered? Are effects only
   used in the right hook scope? Are component variants known?

| Rule | File | What it checks |
|------|------|----------------|
| Reference scopes | [`validateReferenceScopes.ts`](./rules/validateReferenceScopes.ts) | `Answer()`, `Data()`, `Params()`, etc. are used where their data source is available |
| Registered functions | [`validateRegisteredFunctions.ts`](./rules/validateRegisteredFunctions.ts) | Every condition, transformer, effect, and generator name exists in the function registry |
| Registered components | [`validateRegisteredComponents.ts`](./rules/validateRegisteredComponents.ts) | Every block variant exists in the component registry |
| Effect scope | [`validateEffectScope.ts`](./rules/validateEffectScope.ts) | Effects only appear inside access/submit hooks, not in expressions |
