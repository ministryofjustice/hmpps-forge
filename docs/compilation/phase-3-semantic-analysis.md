# Semantic analysis

## Purpose

Semantic analysis validates the meaning of a journey definition after the AST
has been built.

Where DSL validation (phase 1) checks structural shape, semantic analysis
checks that the structure makes sense: references point to valid scopes,
functions and components are registered, and effects only appear where the
engine can execute them.

This follows the standard compiler pattern. A parser (phase 2) builds a typed
intermediate representation. Semantic analysis then walks that IR to check
rules that depend on types, scope, and context — things the parser's grammar
cannot express.

## Pipeline position

Semantic analysis runs inside `JourneyCompiler.compile()`, after the AST is
built and registered and before lowering begins.

At this point Forge has:

- a frozen `ASTNodeIndex` with every node indexed by type
- an `ASTNodeTree` with parent-child relationships
- DSL source metadata attached to each node for error reporting
- the function and component registries for the journey being compiled

The validator queries these structures directly. It does not re-walk the raw
definition objects.

## Inputs and outputs

The main inputs are:

- `ASTNodeIndex` — the type-indexed node registry
- `ASTNodeTree` — the parent-child relationship tree
- `FunctionRegistry` — the active function registry for this journey
- `ComponentRegistry` — the active component registry for this journey

If validation passes, compilation continues to lowering.

Failed validation throws an `AggregateError` containing one or more typed
errors. Errors carry DSL source metadata (path and formatted path) from the
AST nodes, so they point back to what the author wrote.

## Key concepts

### `ASTSemanticValidator`

`ASTSemanticValidator` coordinates the semantic rules. It accepts the AST index,
tree, and registries, runs each rule, and collects errors.

### Rules

Each rule is a function that receives the full AST state and returns any errors
found. Rules query the AST index and tree rather than walking raw objects.

The current rules are:

| Rule | What it checks |
|------|----------------|
| Reference scopes | `Self()` only inside field blocks; `Item()` and `Loop` only inside iterators with sufficient nesting depth |
| Effect scope | Effect functions only inside access or submit hooks |
| Registered functions | Every condition, transformer, generator, and effect name exists in the function registry |
| Registered components | Every block variant exists in the component registry |

### How rules use the AST

Rules use `ASTNodeIndex.findByType()` to locate all nodes of a particular kind,
then use `getAncestorChain()` and `ASTNodeTree.isDescendantOf()` to check scope
and context.

For example, the reference scope rule finds all reference nodes, walks each
one's ancestor chain to count iterator depth, and checks whether `Item()` or
`Loop` levels are within bounds.

### Template subtrees

Iterator templates (`yieldTemplate` / `predicateTemplate` on iterate nodes) are
not registered in `ASTNodeIndex`. This is by design — templates are compiled
once and instantiated per item at runtime, so they are not part of the shared
AST.

Semantic analysis handles templates with a focused template walker that
recursively visits `TemplateNode` subtrees. When the walker encounters a nested
iterate template, it increases the scope depth and walks the inner templates
separately.

### Diagnostic context

Errors use `getDSLSourceMetadata()` to retrieve the DSL path and formatted path
from each AST node. This metadata was attached during AST construction
(phase 2), so semantic analysis errors point to the same authored locations as
DSL validation errors.

## What can fail

Semantic analysis should fail when the AST is structurally valid but
semantically incorrect.

Important failure cases include:

- unregistered functions or component variants
- `Self()` references outside field blocks, or inside a field's own code
  expression
- `Item()` or `Loop` references outside an iterator scope, or beyond the
  available parent iterator depth
- effects used outside access or submission hooks

## Connection to the next phase

After semantic analysis passes, Forge begins lowering. `CompilationPlanner`
builds runtime plans from the registry and tree, and phase compilers generate
the JavaScript functions used during request evaluation.

Semantic analysis ensures the AST is safe for lowering. This lets the lowering
phase focus on code generation without re-checking whether references, functions,
and components are valid.
