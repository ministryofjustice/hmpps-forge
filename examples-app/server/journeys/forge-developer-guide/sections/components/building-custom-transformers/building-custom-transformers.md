---
title: Custom transformers
section: building-functions-and-components
path: building-functions-and-components/custom-transformers
teaches: [defineTransformerFunctions, TransformerFunctionExpr, custom-transformer-shape, transformer-implementation]
prerequisites: [Transformer, pipe, formatters, createForgePackage]
---

<p class="govuk-caption-xl">Functions</p>

# Building custom transformers

Forge ships with transformers for strings, dates, numbers, arrays,
and objects. When you need a transformation that the built-in set
does not cover, you can define your own. Custom transformers follow
the same pattern as all custom functions in Forge: you declare a
shape interface, implement the logic, and register it in a package.

{{slot:toc}}

---

## The shape interface

Every set of custom transformers starts with a shape interface.
This defines the public API that journey definitions will use. Each
property is a function that returns a `TransformerFunctionExpr`:

```typescript
import { TransformerFunctionExpr } from '@ministryofjustice/hmpps-forge/core/authoring'

export interface MyTransformerShape {
  /** Converts a date value into a human-readable relative time string like "Today" or "3 days ago". */
  RelativeTime: () => TransformerFunctionExpr
  /**
   * Shortens a string to the given length, appending the suffix if truncated.
   * @param maxLength - The maximum number of characters to keep.
   * @param suffix - The string to append when truncation occurs.
   */
  Truncate: (maxLength: number, suffix: string) => TransformerFunctionExpr
}
```

The shape is purely a type. It has no runtime behaviour. Its job is
to define what arguments each transformer accepts in definitions.
`RelativeTime` takes no arguments. `Truncate` takes a max length
and a suffix string.

Arguments declared in the shape are resolved by Forge before the
implementation receives them. This means they can be static values
or expressions:

```typescript
// Static arguments
Answer('bio').pipe(MyTransformers.Truncate(100, '...'))

// Dynamic argument
Answer('bio').pipe(MyTransformers.Truncate(Data('maxBioLength'), '...'))
```

---

## The implementation

`defineTransformerFunctions` pairs the shape with implementations.
Each implementation follows the pattern
`(deps) => (value, ...args) => result`:

```typescript
import { defineTransformerFunctions } from '@ministryofjustice/hmpps-forge/core/authoring'

export const { transformers: MyTransformers, implementations: myTransformerImplementations } =
  defineTransformerFunctions<MyTransformerShape, MyDeps>({
    RelativeTime: (deps) => (value: unknown) => {
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

    Truncate: (deps) => (value: unknown, maxLength: number, suffix: string) => {
      if (typeof value !== 'string') {
        throw new TypeError('Truncate expects a string')
      }

      if (value.length <= maxLength) return value

      return value.slice(0, maxLength) + suffix
    },
  })
```

The call returns two things:

- **`transformers`** (here `MyTransformers`) is a builder object
  for use in journey definitions. `MyTransformers.Truncate(100, '...')`
  creates a transformer expression that Forge knows how to evaluate.
- **`implementations`** (here `myTransformerImplementations`) is an
  object containing the actual functions, ready to be registered in
  a package.

### The outer function: dependencies

The outer function `(deps) => ...` receives whatever dependencies
you pass when registering the package. Even if your transformer
does not need any dependencies, the outer function is still
required:

```typescript
RelativeTime: (deps) => (value: unknown) => {
  // deps is available but not used here
}
```

If your transformer does need external services, they are available
through `deps`:

```typescript
FormatCurrency: (deps) => (value: unknown, currencyCode: string) => {
  if (typeof value !== 'number') {
    throw new TypeError('FormatCurrency expects a number')
  }

  return deps.currencyFormatter.format(value, currencyCode)
}
```

### The inner function: value and arguments

The inner function receives the resolved value as its first
parameter, followed by any arguments declared in the shape. The
value is whatever the reference or previous transformer in the
pipeline resolved to. The arguments are whatever the definition
passed in, after Forge has resolved any expressions.

The value type is `unknown` because the resolved value depends on
what sits before the transformer in the pipeline. Always verify the
type at runtime.

---

## Author-time preparation

Factory entries can also be written as `{ prepare, factory }`,
where `prepare` is an optional hook that runs synchronously when
the transformer builder is called. Use it to sanitise or reshape
arguments before they enter the expression tree, and to reject
invalid arguments early — when the journey module loads rather
than at render time.

`prepare` receives only the arguments the author passed to the
builder and returns them as an array. The returned array replaces
the original arguments in the built expression.

```typescript
export const { transformers: MyTransformers, implementations: myTransformerImplementations } =
  defineTransformerFunctions<MyTransformerShape, MyDeps>({
    Truncate: {
      prepare: (maxLength: number, suffix: string): [number, string] => {
        if (!Number.isInteger(maxLength) || maxLength < 1) {
          throw new Error('Truncate requires a positive integer maxLength')
        }

        if (typeof suffix !== 'string') {
          throw new Error('Truncate requires a string suffix')
        }

        return [maxLength, suffix]
      },
      factory: (deps) => (value: unknown, maxLength: number, suffix: string) => {
        if (typeof value !== 'string') {
          throw new TypeError('Truncate expects a string')
        }

        if (value.length <= maxLength) return value

        return value.slice(0, maxLength) + suffix
      },
    },
  })
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

---

## Type checking with TypeError

Transformer inputs are resolved at runtime, so you cannot rely on
TypeScript's compiler to catch type mismatches. Verify the value
matches what you expect, and throw a `TypeError` if it does not.

```typescript
Slugify: (deps) => (value: unknown) => {
  if (typeof value !== 'string') {
    throw new TypeError('Slugify expects a string')
  }

  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
```

Forge treats `TypeError` differently from other errors. Outside of
validation, a `TypeError` immediately surfaces as a configuration
error so you can catch the problem during development. Inside
`validWhen`, it is caught and treated as a validation failure. Use
`TypeError` specifically, not `Error`, so Forge can distinguish
type mismatches from other failures.

---

## Registration

Transformer implementations are registered in a package through
the `functions` property:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'

export default createForgePackage<MyDeps>({
  journey: myJourney,
  functions: {
    ...myTransformerImplementations,
  },
})
```

Dependencies are injected at application startup when you register
the package:

```typescript
forge.registerPackage(myPackage, {
  currencyFormatter: services.currencyFormatter,
})
```

Every transformer in the package receives these dependencies as its
outer function argument.

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

Because the implementation is a plain function, you can test it
without Forge. Call the outer function with mock dependencies, then
call the inner function with a value:

```typescript
describe('MyTransformers', () => {
  describe('Truncate', () => {
    const truncate = myTransformerImplementations.Truncate({} as MyDeps)

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

If your transformer depends on an external service, stub the
dependency in the outer function:

```typescript
const formatCurrency = myTransformerImplementations.FormatCurrency({
  currencyFormatter: { format: (v, c) => `${c} ${v.toFixed(2)}` },
} as MyDeps)

expect(formatCurrency(42.5, 'GBP')).toBe('GBP 42.50')
```

---

## Best practices

- **Verify the input type.** The resolved value is `unknown`. Check
  it before operating on it and throw `TypeError` if it does not
  match.
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
- **Prepare arguments at author time.** Use the
  `{ prepare, factory }` form to sanitise arguments and catch
  configuration errors at module load rather than at render time.
