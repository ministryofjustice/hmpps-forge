---
title: Custom transformers
section: building-functions-and-components
path: building-functions-and-components/custom-transformers
teaches: [transformer, TransformerRegistry, register, inputSchema, argumentsSchema, transformer-implementation]
prerequisites: [Transformer, pipe, formatters, createForgePackage]
---

<p class="govuk-caption-xl">Functions</p>

# Building custom transformers

Forge ships with transformers for strings, dates, numbers, arrays,
and objects. When you need a transformation that the built-in set
does not cover, you can define your own. A custom transformer is
declared with `transformer()`, and using it in a journey registers
it automatically.

{{slot:toc}}

---

## Declaring transformers

`transformer()` takes a name and an options object containing the
factory. It returns a callable handle you use directly in journey
definitions:

```typescript
import { transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

/** Converts a date value into a human-readable relative time string like "Today" or "3 days ago". */
export const RelativeTime = transformer('RelativeTime', {
  factory: () => (value: unknown) => {
    if (typeof value !== 'string' && !(value instanceof Date)) {
      throw new TypeError('RelativeTime expects a string or Date')
    }

    const date = new Date(value)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'

    return `${diffDays} days ago`
  },
})

/**
 * Shortens a string to the given length, appending the suffix if truncated.
 * @param maxLength - The maximum number of characters to keep.
 * @param suffix - The string to append when truncation occurs.
 */
export const Truncate = transformer('Truncate', {
  factory: () => (value: unknown, maxLength: number, suffix: string) => {
    if (typeof value !== 'string') {
      throw new TypeError('Truncate expects a string')
    }

    if (value.length <= maxLength) return value

    return value.slice(0, maxLength) + suffix
  },
})
```

There is no registry to create and no shape interface to maintain.
The factory follows the pattern `(deps) => (value, ...args) => result`,
and the argument types come straight from it: `Truncate` is
`(maxLength, suffix) => TransformerFunctionExpr` and `RelativeTime`
is `() => TransformerFunctionExpr`. `Truncate(100, '...')` creates a
transformer expression that Forge knows how to evaluate.

Arguments passed to a handle can be static values or expressions.
Each parameter automatically accepts an expression as well as the
type the factory declares - there is no widening to do - and Forge
resolves the expression before the evaluator runs:

```typescript
// Static arguments
Answer('bio').pipe(Truncate(100, '...'))

// Dynamic argument
Answer('bio').pipe(Truncate(Data('maxBioLength'), '...'))
```

Using the handle anywhere in a journey definition is also what
registers it. At `registerPackage()`, Forge collects every entry
the journey uses and registers its evaluator - there is nothing to
list on the package.

### The outer function: dependencies

The outer function `(deps) => ...` receives whatever dependencies
you pass when registering the package. Pass the dependency type as
a type argument, and omit the parameter when it is unused:

```typescript
export const FormatCurrency = transformer<MyDeps>('FormatCurrency', {
  factory: (deps) => (value: unknown, currencyCode: string) => {
    if (typeof value !== 'number') {
      throw new TypeError('FormatCurrency expects a number')
    }

    return deps.currencyFormatter.format(value, currencyCode)
  },
})
```

### The inner function: value and arguments

The inner function receives the resolved value as its first
parameter, followed by any arguments the handle was called with.
The value is whatever the reference or previous transformer in the
pipeline resolved to. The arguments are whatever the definition
passed in, after Forge has resolved any expressions.

The value type is `unknown` because the resolved value depends on
what sits before the transformer in the pipeline. Verify the type
at runtime, or declare an `inputSchema` (see below) to have Forge
check it for you.

---

## Validating inputs and arguments

The options object accepts Zod schemas that Forge applies before
your evaluator runs. This is the declarative alternative to manual
`typeof` checks:

- **`inputSchema`** validates the resolved value.
- **`argumentsSchema`** validates the author-supplied arguments. It
  is a `z.tuple` describing each positional argument.
- **`outputSchema`** validates the return value.

```typescript
import { z } from 'zod'
import { transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

/**
 * Shortens a string to the given length, appending the suffix if truncated.
 * @param maxLength - The maximum number of characters to keep.
 * @param suffix - The string to append when truncation occurs.
 */
export const Truncate = transformer('Truncate', {
  inputSchema: z.string(),
  argumentsSchema: z.tuple([z.number().int().positive(), z.string()]),
  factory: () => (value: string, maxLength: number, suffix: string) => {
    if (value.length <= maxLength) return value

    return value.slice(0, maxLength) + suffix
  },
})
```

With `inputSchema: z.string()` in place, a non-string value never
reaches the evaluator — Forge throws a `TypeError` instead. That
lets the factory type its value parameter as `string` and drop the
manual `typeof` guard. A failed `argumentsSchema` also throws a
`TypeError`: an author passing a zero or negative `maxLength` is a
configuration mistake, not user input.

Schemas run at request time, each time the transformer is
evaluated — not when the journey module loads.

Argument-count mismatches against a tuple schema are additionally caught at `registerPackage()` by semantic analysis, so a call with the wrong number of arguments fails compilation instead of waiting for request time.

---

## Author-time preparation

The options object also accepts a `prepare` hook that runs
synchronously when the transformer handle is called. Use it to
sanitise or reshape arguments before they enter the expression
tree, and to reject invalid arguments early — when the journey
module loads rather than at render time.

`prepare` receives only the arguments the author passed to the
handle and returns them as an array. The returned array replaces
the original arguments in the built expression.

```typescript
export const Truncate = transformer('Truncate', {
  prepare: (maxLength: number, suffix: string): [number, string] => {
    if (!Number.isInteger(maxLength) || maxLength < 1) {
      throw new Error('Truncate requires a positive integer maxLength')
    }

    if (typeof suffix !== 'string') {
      throw new Error('Truncate requires a string suffix')
    }

    return [maxLength, suffix]
  },
  factory: () => (value: unknown, maxLength: number, suffix: string) => {
    if (typeof value !== 'string') {
      throw new TypeError('Truncate expects a string')
    }

    if (value.length <= maxLength) return value

    return value.slice(0, maxLength) + suffix
  },
})
```

A bad call fails as soon as the definition is imported:

```typescript
// Throws 'Truncate requires a positive integer maxLength'.
Truncate(0, '...')
```

`prepare` does not see injected dependencies or the runtime value,
so it can only check structural properties of the arguments:
required fields, numeric ranges, enum membership, or combinations
of arguments. Checks that depend on the resolved value belong
inside the evaluator.

If an argument is itself an expression like `Data('maxBioLength')`,
its resolved value is not available at author time. Validate the
resolved value inside the evaluator instead.

`argumentsSchema` and `prepare` overlap: a schema validates
arguments, `prepare` can both validate and reshape them. They also
run at different times — `prepare` runs once, when the definition
is built at module load; `argumentsSchema` runs at request time,
each time the transformer is evaluated. Reach for `argumentsSchema`
when you only need to check the arguments, and `prepare` when you
need to transform them or fail as early as possible.

---

## Type checking with TypeError

Transformer inputs are resolved at runtime, so you cannot rely on
TypeScript's compiler to catch type mismatches. When you have not
declared an `inputSchema`, verify the value matches what you
expect, and throw a `TypeError` if it does not.

```typescript
export const Slugify = transformer('Slugify', {
  factory: () => (value: unknown) => {
    if (typeof value !== 'string') {
      throw new TypeError('Slugify expects a string')
    }

    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  },
})
```

Forge treats `TypeError` differently from other errors. Outside of
validation, a `TypeError` immediately surfaces as a configuration
error so you can catch the problem during development. Inside
`validWhen`, it is caught and treated as a validation failure. Use
`TypeError` specifically, not `Error`, so Forge can distinguish
type mismatches from other failures.

---

## Registration

Using a transformer in a journey definition registers it - there is
nothing to declare on the package. Dependencies are injected at
application startup when you register the package, and every
entry's factory receives them:

```typescript
forge.registerPackage(myPackage, {
  currencyFormatter: services.currencyFormatter,
})
```

If a journey refers to a transformer only by name - a journey
defined in JSON, for example - nothing uses the handle, so there is
nothing to collect. List the entry on the package's `functions`
property to register it under its declared name regardless:

```typescript
export default createForgePackage<MyDeps>({
  journey: myJourney,
  functions: [Truncate, RelativeTime],
})
```

The `functions` array mixes entries and registries freely. To share
transformers across journeys, use the same entries in each journey,
or group them on a registry and list it on each package - see
[Grouping with a registry](#grouping-with-a-registry).

---

## Using custom transformers

Custom transformers work the same way as built-in transformers.
They can be used with `.pipe()` on references and generators, and
in the `formatters` property on fields.

### In `.pipe()`

```typescript
Item().path('createdAt').pipe(RelativeTime())

Answer('bio').pipe(Truncate(200, '...'))
```

### In `formatters`

```typescript
GovUKTextInput({
  code: 'slug',
  label: { text: 'URL slug' },
  formatters: [Slugify()],
})
```

### Chaining with built-in transformers

Custom and built-in transformers can be mixed freely in a pipeline.
Each one receives the output of the previous:

```typescript
Answer('name').pipe(
  Transformer.String.Trim(),
  Slugify(),
  Truncate(50, ''),
)
```

---

## Testing

Test a transformer with `FunctionRegistryTestHarness` from the
testing module. Pass the entry to the constructor, then evaluate
the expression the handle builds. The harness runs the engine's
real evaluation pipeline - schemas, short-circuits, and output
validation - so a wrong schema fails in your tests rather than
shipping silently:

```typescript
import { FunctionRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'

describe('Truncate', () => {
  const harness = new FunctionRegistryTestHarness(Truncate)

  it('should return the value unchanged when shorter than max length', () => {
    // Arrange / Act
    const result = harness.evaluate(Truncate(10, '...')).withInput('short')

    // Assert
    expect(result).toBe('short')
  })

  it('should truncate and append suffix when longer than max length', () => {
    // Arrange / Act
    const result = harness.evaluate(Truncate(10, '...')).withInput('a long string that should be truncated')

    // Assert
    expect(result).toBe('a long str...')
  })

  it('should throw TypeError when value is not a string', () => {
    // Arrange / Act / Assert
    expect(() => harness.evaluate(Truncate(10, '...')).withInput(123)).toThrow(TypeError)
  })
})
```

If your transformer depends on an external service, pass a stub as
the second constructor argument:

```typescript
const harness = new FunctionRegistryTestHarness(FormatCurrency, {
  currencyFormatter: { format: (v, c) => `${c} ${v.toFixed(2)}` },
} as MyDeps)

expect(harness.evaluate(FormatCurrency('GBP')).withInput(42.5)).toBe('GBP 42.50')
```

`withInput` supplies the value the engine would resolve from the
reference at runtime; the arguments come from the handle call.

---

## Grouping with a registry

Entries suit transformers that live alongside the journeys using
them. When a package exposes a family of transformers as a shared
API - or when several packages share the same transformers - a
`TransformerRegistry` groups them under one handle object:

```typescript
import { TransformerRegistry } from '@ministryofjustice/hmpps-forge/core/authoring'

const myTransformers = new TransformerRegistry<MyDeps>()

export const MyTransformers = {
  /** Converts a date value into a human-readable relative time string like "Today" or "3 days ago". */
  RelativeTime: myTransformers.register('RelativeTime', () => (value: unknown) => {
    // same evaluator as the entry form
  }),
}
```

`register` takes the same options (`inputSchema`, `argumentsSchema`,
`outputSchema`, `prepare`) and the same factory shape, and returns
the same kind of callable handle. Two differences from entries:

- Nothing registers automatically. Pass the registry to a package's
  `functions` property:

  ```typescript
  export const myPackage = createForgePackage({
    journey: myJourney,
    functions: myTransformers,
  })
  ```

- Handle parameters accept only the types the factory declares. To
  accept expressions too, widen the parameter to
  `number | ResolvableValue` (exported from
  `@ministryofjustice/hmpps-forge/core/authoring`) - the built-in
  transformers do the same.

`FunctionRegistryTestHarness` accepts a registry in place of an
entry, so the testing pattern above works unchanged.

---

## Best practices

- **Verify the input type.** The resolved value is `unknown`.
  Declare an `inputSchema`, or check it and throw `TypeError` if it
  does not match.
- **Keep transformers pure.** A transformer should take a value and
  return a new value. If you need to read answers, set data, or
  call APIs, that is an effect, not a transformer.
- **Name transformers after what they produce, not what they
  consume.** `RelativeTime` describes the output. `ParseDateString`
  describes the input. Readers care about what comes out of the
  pipeline.
- **Use `formatters` for normalising input, `.pipe()` for shaping
  output.** Formatters run during the submission pipeline before
  validation. `.pipe()` runs at evaluation time for display and
  conditions.
- **Validate arguments early.** Use a `prepare` hook to catch
  configuration errors at module load, or an `argumentsSchema` to
  catch them at request time before the evaluator runs.
