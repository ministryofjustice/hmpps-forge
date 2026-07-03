---
title: Custom transformers
section: building-functions-and-components
path: building-functions-and-components/custom-transformers
teaches: [TransformerRegistry, register, inputSchema, argumentsSchema, transformer-implementation]
prerequisites: [Transformer, pipe, formatters, createForgePackage]
---

<p class="govuk-caption-xl">Functions</p>

# Building custom transformers

Forge ships with transformers for strings, dates, numbers, arrays,
and objects. When you need a transformation that the built-in set
does not cover, you can define your own. Custom transformers follow
the same pattern as all custom functions in Forge: you register them
on a registry and pass that registry to a package.

{{slot:toc}}

---

## Declaring transformers

Custom transformers are declared through a `TransformerRegistry`.
You create one registry, register each transformer on it, and group
the returned handles in a plain object for use in journey
definitions:

```typescript
import { TransformerRegistry } from '@ministryofjustice/hmpps-forge/core/authoring'

const myTransformers = new TransformerRegistry<MyDeps>()

export const MyTransformers = {
  /** Converts a date value into a human-readable relative time string like "Today" or "3 days ago". */
  RelativeTime: myTransformers.register(
    'RelativeTime',
    (deps) => (value: unknown) => {
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
  ),

  /**
   * Shortens a string to the given length, appending the suffix if truncated.
   * @param maxLength - The maximum number of characters to keep.
   * @param suffix - The string to append when truncation occurs.
   */
  Truncate: myTransformers.register(
    'Truncate',
    (deps) => (value: unknown, maxLength: number, suffix: string) => {
      if (typeof value !== 'string') {
        throw new TypeError('Truncate expects a string')
      }

      if (value.length <= maxLength) return value

      return value.slice(0, maxLength) + suffix
    },
  ),
}
```

There is no separate shape interface to maintain. `register` infers
the argument types straight from the factory, so
`MyTransformers.Truncate` becomes
`(maxLength: number, suffix: string) => TransformerFunctionExpr`
and `MyTransformers.RelativeTime` becomes
`() => TransformerFunctionExpr`. The JSDoc on each grouped handle
documents the transformer the same way a shape interface used to.

Each `register` call takes a name, an optional options object, and
a factory following the pattern `(deps) => (value, ...args) => result`.
It returns a callable handle. `MyTransformers.Truncate(100, '...')`
creates a transformer expression that Forge knows how to evaluate.

Arguments passed to a handle can be static values or expressions:

```typescript
// Static arguments
Answer('bio').pipe(MyTransformers.Truncate(100, '...'))

// Dynamic argument
Answer('bio').pipe(MyTransformers.Truncate(Data('maxBioLength'), '...'))
```

### The outer function: dependencies

The outer function `(deps) => ...` receives whatever dependencies
you pass when registering the package. Even if your transformer
does not need any dependencies, the outer function is still
required. Omit its parameter when it is unused:

```typescript
RelativeTime: myTransformers.register('RelativeTime', () => (value: unknown) => {
  // no dependencies needed here
}),
```

If your transformer does need external services, they are available
through `deps`:

```typescript
FormatCurrency: myTransformers.register(
  'FormatCurrency',
  (deps) => (value: unknown, currencyCode: string) => {
    if (typeof value !== 'number') {
      throw new TypeError('FormatCurrency expects a number')
    }

    return deps.currencyFormatter.format(value, currencyCode)
  },
),
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
import { TransformerRegistry } from '@ministryofjustice/hmpps-forge/core/authoring'

const myTransformers = new TransformerRegistry<MyDeps>()

export const MyTransformers = {
  /**
   * Shortens a string to the given length, appending the suffix if truncated.
   * @param maxLength - The maximum number of characters to keep.
   * @param suffix - The string to append when truncation occurs.
   */
  Truncate: myTransformers.register(
    'Truncate',
    {
      inputSchema: z.string(),
      argumentsSchema: z.tuple([z.number().int().positive(), z.string()]),
    },
    (deps) => (value: string, maxLength: number, suffix: string) => {
      if (value.length <= maxLength) return value

      return value.slice(0, maxLength) + suffix
    },
  ),
}
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
const myTransformers = new TransformerRegistry<MyDeps>()

export const MyTransformers = {
  Truncate: myTransformers.register(
    'Truncate',
    {
      prepare: (maxLength: number, suffix: string): [number, string] => {
        if (!Number.isInteger(maxLength) || maxLength < 1) {
          throw new Error('Truncate requires a positive integer maxLength')
        }

        if (typeof suffix !== 'string') {
          throw new Error('Truncate requires a string suffix')
        }

        return [maxLength, suffix]
      },
    },
    (deps) => (value: unknown, maxLength: number, suffix: string) => {
      if (typeof value !== 'string') {
        throw new TypeError('Truncate expects a string')
      }

      if (value.length <= maxLength) return value

      return value.slice(0, maxLength) + suffix
    },
  ),
}
```

A bad call fails as soon as the definition is imported:

```typescript
// Throws 'Truncate requires a positive integer maxLength'.
MyTransformers.Truncate(0, '...')
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
Slugify: myTransformers.register('Slugify', (deps) => (value: unknown) => {
  if (typeof value !== 'string') {
    throw new TypeError('Slugify expects a string')
  }

  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}),
```

Forge treats `TypeError` differently from other errors. Outside of
validation, a `TypeError` immediately surfaces as a configuration
error so you can catch the problem during development. Inside
`validWhen`, it is caught and treated as a validation failure. Use
`TypeError` specifically, not `Error`, so Forge can distinguish
type mismatches from other failures.

---

## Registration

Pass the registry to a package through the `functions` property:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'

export default createForgePackage<MyDeps>({
  journey: myJourney,
  functions: myTransformers,
})
```

`functions` also accepts an array of registries when a package
mixes several function kinds:

```typescript
functions: [myTransformers, myConditions],
```

Dependencies are injected at application startup when you register
the package:

```typescript
forge.registerPackage(myPackage, {
  currencyFormatter: services.currencyFormatter,
})
```

Every transformer in the registry receives these dependencies as
its outer function argument. To make transformers available to
every journey rather than a single package, register the registry
globally instead:

```typescript
forge.registerGlobalFunctions(myTransformers, {
  currencyFormatter: services.currencyFormatter,
})
```

---

## Using custom transformers

Custom transformers work the same way as built-in transformers.
They can be used with `.pipe()` on references and generators, and
in the `formatters` property on fields.

### In `.pipe()`

```typescript
Item().path('createdAt').pipe(MyTransformers.RelativeTime())

Answer('bio').pipe(MyTransformers.Truncate(200, '...'))
```

### In `formatters`

```typescript
GovUKTextInput({
  code: 'slug',
  label: { text: 'URL slug' },
  formatters: [MyTransformers.Slugify()],
})
```

### Chaining with built-in transformers

Custom and built-in transformers can be mixed freely in a pipeline.
Each one receives the output of the previous:

```typescript
Answer('name').pipe(
  Transformer.String.Trim(),
  MyTransformers.Slugify(),
  MyTransformers.Truncate(50, ''),
)
```

---

## Testing

`register` returns an expression handle, not the underlying
function, so tests evaluate the transformer through the registry's
`build` method. Call `build` with mock dependencies to get an
object keyed by name, then read the `evaluate` function:

```typescript
describe('MyTransformers', () => {
  describe('Truncate', () => {
    const truncate = myTransformers.build({} as MyDeps).Truncate.evaluate

    it('should return the value unchanged when shorter than max length', () => {
      // Arrange
      const value = 'short'

      // Act
      const result = truncate(value, 10, '...')

      // Assert
      expect(result).toBe('short')
    })

    it('should truncate and append suffix when longer than max length', () => {
      // Arrange
      const value = 'a long string that should be truncated'

      // Act
      const result = truncate(value, 10, '...')

      // Assert
      expect(result).toBe('a long str...')
    })

    it('should throw TypeError when value is not a string', () => {
      // Arrange / Act / Assert
      expect(() => truncate(123, 10, '...')).toThrow(TypeError)
    })
  })
})
```

If your transformer depends on an external service, pass a stub to
`build`:

```typescript
const formatCurrency = myTransformers.build({
  currencyFormatter: { format: (v, c) => `${c} ${v.toFixed(2)}` },
} as MyDeps).FormatCurrency.evaluate

expect(formatCurrency(42.5, 'GBP')).toBe('GBP 42.50')
```

`build` returns the entry keyed by the name you registered, and
`evaluate` is the `(value, ...args) => result` function itself. It
bypasses the schemas and `prepare`, so it exercises the evaluator
logic directly.

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
