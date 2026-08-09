# authoring-validation

Authoring validation checks the author's journey definition *before* it reaches the AST.
It catches structural mistakes early - missing fields, invalid schemas, non-serialisable
values - so the error message can point at what the author wrote, not at a compiler crash.

Two pre-AST checks, both driven by [`DSLValidator`](./DSLValidator.ts):

1. **Serialisation validation** - `DSLValidator.validateJSON` checks that object
   definitions are JSON-compatible (no functions, symbols, circular refs, etc.).
2. **Schema validation** - [`schemas/`](./schemas/) defines Zod schemas for
   structures, expressions, and predicates. `DSLValidator.validateSchema` runs
   the authored input against them.

Semantic rules (registered functions, registered components, reference scopes,
effect scopes) run **after** the AST is built, inside
[`compilation/semantic-analysis/`](../compilation/semantic-analysis/). This follows the standard compiler
pattern: parse first, then validate the typed IR.

The folder is named for what it validates rather than what it is, because the engine has a second, unrelated
notion of validation: the [validation concern](../concerns/validation/README.md), which decides at request time
whether a user's answers pass the rules the author wrote.
