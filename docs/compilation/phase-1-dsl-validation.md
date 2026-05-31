# DSL validation

## Purpose

DSL validation checks a journey definition before Forge builds the AST.

It checks that the definition:

- can be represented as Forge DSL
- has the structure the engine expects

This is validation of the framework configuration shape. It is not form
submission validation. Runtime field validation is compiled later as part of
request evaluation.

DSL validation protects the AST construction phase from structurally invalid
input.

## Pipeline position

DSL validation runs when Forge creates a `PackageInstance` from a journey
definition. It runs before Forge builds the AST, runs semantic analysis,
compiles route artefacts, or mounts routes.

The validation flow has two gates:

1. **Serialisation validation** checks that object definitions can be
   represented as JSON.

2. **Schema validation** checks the definition shape using Zod schemas.

Definitions supplied as strings are parsed as JSON before schema validation.

Definitions supplied as objects pass through serialisation validation first.
This means builder output must have the same JSON-compatible shape as parsed
DSL.

Semantic rules (registered functions, registered components, reference scopes,
effect scopes) run after the AST is built. See
[phase 3 - semantic analysis](./phase-3-semantic-analysis.md).

## Inputs and outputs

The main input is a `JourneyDefinition` or JSON string supplied to Forge during
registration.

If validation passes, Forge keeps using the same definition and moves it into
AST construction.

Failed validation throws either a configuration error directly or an
`AggregateError` containing one or more configuration errors.

Errors include DSL path information. This lets Forge report the problem against
the authored definition, rather than against generated code or runtime
handlers.

## Key concepts

### `DSLValidator`

`DSLValidator` coordinates the two validation gates.

It does not build the intermediate representation. It validates the raw
definition before the compilation pipeline uses it.

The two public validators reflect the two gates:

- `validateJSON`
- `validateSchema`

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

DSL validation checks that a block is structurally valid. Component packages
remain responsible for the meaning of variant-specific properties.

### Diagnostic paths

Validation errors carry both raw path data and formatted DSL paths. Formatted
paths prefer journey codes, step paths or titles, block variants, field codes,
and function names where available.

The goal is for startup errors to point to the authored journey shape, not just
to an array index.

## What can fail

DSL validation should fail before AST construction when the definition is not
structurally sound.

Important failure cases include:

- non-serialisable authored objects.
- missing required structure, invalid discriminators, or malformed expression
  shapes.

## Connection to the next phase

After DSL validation succeeds, Forge builds the intermediate representation.
The definition is transformed into typed AST nodes, indexed, and prepared for
semantic analysis.

DSL validation runs before that transformation so structural errors stay close
to the authored DSL shape.
