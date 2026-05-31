# DSL validation

## Purpose

DSL validation checks a journey definition before Forge compiles it.

It checks that the definition:

- can be represented as Forge DSL
- has the structure the engine expects
- only refers to scoped references, functions, and component variants that
  Forge can resolve

This is validation of the framework configuration. It is not form submission
validation. Runtime field validation is compiled later as part of request
evaluation.

DSL validation protects the compiler from invalid journey structure.

## Pipeline position

Validation runs when Forge creates a `PackageInstance` from a journey
definition. It runs before Forge builds the intermediate representation,
compiles route artefacts, or mounts routes.

The validation flow has three gates:

1. **Serialisation validation** checks that object definitions can be
   represented as JSON.

2. **Schema validation** checks the definition shape using Zod schemas.

3. **Tree validation** walks the definition and checks rules that depend on
   registries or scope.

Definitions supplied as strings are parsed as JSON before schema and tree
validation.

Definitions supplied as objects pass through serialisation validation first.
This means builder output must have the same JSON-compatible shape as parsed
DSL.

## Inputs and outputs

The main input is a `JourneyDefinition` or JSON string supplied to Forge during
registration. Tree validation also depends on the function and component
registries for the journey being registered, including any package-scoped
registries layered over the global registries.

If validation passes, Forge keeps using the same definition and moves it into
IR construction and compilation.

Failed validation throws either a configuration error directly or an
`AggregateError` containing one or more configuration errors.

Errors include DSL path information. This lets Forge report the problem against
the authored definition, rather than against generated code or runtime
handlers.

## Key concepts

### `DSLValidator`

`DSLValidator` coordinates the three validation gates.

It does not build the intermediate representation. It validates the raw
definition before the compilation pipeline uses it.

The three public validators reflect the three gates:

- `validateJSON`
- `validateSchema`
- `validateTree`

### Serialisation validation

Serialisation validation checks that object definitions are JSON-compatible.

It rejects values that cannot safely cross the DSL boundary, such as:

- `undefined`
- functions
- symbols
- `bigint`
- `Date` instances
- non-plain objects
- circular structures

This keeps authored definitions inspectable and serialisable before Forge starts
building engine-specific structures from them.

### Schema validation

Schema validation uses Zod to check the structural shape of the DSL. The schema
files are grouped around the major DSL families:

- `structures.schema.ts` covers journeys, steps, blocks, hooks, validation
  expressions, views, and reachability configuration.
- `expressions.schema.ts` covers references, pipelines, iterators, and
  resolvable values.
- `predicates.schema.ts` covers predicate expressions, conditionals, matches,
  and hook outcomes.
- `base.schema.ts` covers function expressions for conditions, transformers,
  generators, and effects.

The schemas are intentionally broad where component-specific props are
concerned.

DSL validation checks that a block is structurally valid and that its variant is
registered. Component packages remain responsible for the meaning of
variant-specific properties.

### Tree validation

Tree validation walks the raw definition and applies semantic rules that cannot
be expressed by schema shape alone.

The walker tracks:

- the current DSL path
- ancestor nodes
- iterator scope
- whether the current position is inside a field code expression

Rules are grouped by the kind of node they validate:

- reference rules validate reference paths such as `Self()`, `Item()`, and
  `Loop`.
- function rules validate function expressions such as conditions,
  transformers, generators, and effects.
- block rules validate block variants.

The current tree rules check that:

- referenced functions must exist in the active function registry.
- referenced component variants must exist in the active component registry.
- scoped references must be used where their scope exists.
- effects must only appear inside hooks.

### Diagnostic paths

Validation errors carry both raw path data and formatted DSL paths. Formatted
paths prefer journey codes, step paths or titles, block variants, field codes,
and function names where available.

The goal is for startup errors to point to the authored journey shape, not just
to an array index.

## What can fail

Validation should fail before compilation when Forge cannot safely compile a
definition.

Important failure cases include:

- non-serialisable authored objects.
- missing required structure, invalid discriminators, or malformed expression
  shapes.
- unregistered functions or component variants.
- `Self()` references outside field blocks, or inside a field's own code
  expression.
- `Item()` or `Loop` references outside an iterator scope, or beyond the
  available parent iterator depth.
- effects used outside access or submission hooks.

The compiler should only receive definitions that have already passed these
checks. This lets compilation focus on building IR, plans, and generated
functions.

## Connection to the next phase

After validation succeeds, Forge builds the intermediate representation. The
definition is transformed into typed AST nodes, indexed, and prepared for plan
building and code generation.

Validation runs before that transformation so configuration errors stay close
to the authored DSL.

This prevents invalid definitions from leaking into compilation, where failures
would be harder to diagnose and more likely to surface as implementation
errors.
