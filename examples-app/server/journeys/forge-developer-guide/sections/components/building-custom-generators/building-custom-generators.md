---
title: Custom generators
section: building-functions-and-components
path: building-functions-and-components/custom-generators
teaches: [GeneratorRegistry, register, argumentsSchema, generator-implementation]
prerequisites: [Generator, pipe, createForgePackage]
---

<p class="govuk-caption-xl">Functions</p>

# Building custom generators

Generators produce values at runtime. The built-in generators
cover dates, but your application might need UUIDs, reference
numbers, or computed defaults. Custom generators let you define
any value-producing function and use it in your definitions the
same way you use `Generator.Date.Today()`.

{{slot:toc}}

---

## Declaring generators

Custom generators are declared through a `GeneratorRegistry`. You
create one registry, register each generator on it, and group the
returned handles in a plain object for use in journey definitions:

```typescript
import { GeneratorRegistry } from '@ministryofjustice/hmpps-forge/core/authoring'

const myGenerators = new GeneratorRegistry<MyDeps>()

export const MyGenerators = {
  /** Produces a new v4 UUID. */
  NewUUID: myGenerators.register('NewUUID', (deps) => () => {
    return crypto.randomUUID()
  }),

  /**
   * Produces a unique reference number with the given prefix.
   * @param prefix - The string to prepend to the generated number.
   */
  NewReferenceNumber: myGenerators.register(
    'NewReferenceNumber',
    (deps) => (prefix: string) => {
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 6)

      return `${prefix}-${timestamp}-${random}`.toUpperCase()
    },
  ),
}
```

There is no separate shape interface to maintain. `register` infers
the argument types straight from the factory, so
`MyGenerators.NewReferenceNumber` becomes
`(prefix: string) => GeneratorBuilder` and `MyGenerators.NewUUID`
becomes `() => GeneratorBuilder`. The JSDoc on each grouped handle
documents the generator the same way a shape interface used to.

Each `register` call takes a name, an optional options object, and
a factory following the pattern `(deps) => (...args) => result`. It
returns a callable handle. `MyGenerators.NewUUID()` creates an
expression that Forge evaluates at runtime.

As with all custom functions, arguments passed to a handle can be
static values or expressions:

```typescript
defaultValue: MyGenerators.NewReferenceNumber('REF')
defaultValue: MyGenerators.NewReferenceNumber(Data('referencePrefix'))
```

### How generators differ from transformers

Generators and transformers follow a similar pattern, but with one
key difference. A transformer receives a value as its first
parameter and reshapes it. A generator receives no value. It
produces something from nothing.

```typescript
// Transformer: (deps) => (value, ...args) => result
Slugify: myTransformers.register('Slugify', (deps) => (value: unknown) => { ... })

// Generator: (deps) => (...args) => result
NewUUID: myGenerators.register('NewUUID', (deps) => () => { ... })
```

### The outer function: dependencies

The outer function `(deps) => ...` receives injected dependencies,
even if your generator does not need them. If it does need external
services, they are available through `deps`:

```typescript
NextSequenceNumber: myGenerators.register('NextSequenceNumber', (deps) => () => {
  return deps.sequenceService.next()
}),
```

---

## Validating arguments

The options object accepts Zod schemas that Forge applies before
your evaluator runs:

- **`argumentsSchema`** validates the author-supplied arguments. It
  is a `z.tuple` describing each positional argument.
- **`outputSchema`** validates the return value.

Generators have no resolved value, so `inputSchema` does not apply.

```typescript
import { z } from 'zod'
import { GeneratorRegistry } from '@ministryofjustice/hmpps-forge/core/authoring'

const myGenerators = new GeneratorRegistry<MyDeps>()

export const MyGenerators = {
  /**
   * Produces a unique reference number with the given prefix.
   * @param prefix - The string to prepend to the generated number.
   */
  NewReferenceNumber: myGenerators.register(
    'NewReferenceNumber',
    {
      argumentsSchema: z.tuple([z.string().min(1)]),
    },
    (deps) => (prefix: string) => {
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 6)

      return `${prefix}-${timestamp}-${random}`.toUpperCase()
    },
  ),
}
```

The `argumentsSchema` catches an author passing an empty prefix.
A failed schema throws a `TypeError` at request time, when the
generator is evaluated — not when the journey module loads.

---

## Author-time preparation

The options object also accepts a `prepare` hook that runs
synchronously when the generator handle is called. Use it to
sanitise or reshape arguments before they enter the expression
tree, and to reject invalid arguments early — when the journey
module loads rather than at render time.

`prepare` receives the same arguments as the evaluator and returns
them as an array. The returned array replaces the original
arguments in the built expression.

```typescript
const myGenerators = new GeneratorRegistry<MyDeps>()

export const MyGenerators = {
  NewReferenceNumber: myGenerators.register(
    'NewReferenceNumber',
    {
      prepare: (prefix: string): [string] => {
        if (typeof prefix !== 'string' || prefix.length === 0) {
          throw new Error('NewReferenceNumber requires a non-empty prefix')
        }

        return [prefix]
      },
    },
    (deps) => (prefix: string) => {
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 6)

      return `${prefix}-${timestamp}-${random}`.toUpperCase()
    },
  ),
}
```

A bad call fails as soon as the definition is imported:

```typescript
// Throws 'NewReferenceNumber requires a non-empty prefix'.
MyGenerators.NewReferenceNumber('')
```

Since generators have no injected first parameter, `prepare` sees
exactly what the author passed to the handle. Use it for structural
checks (required fields, numeric ranges, enum membership) and for
stripping properties that are not needed at runtime. Checks that
depend on injected dependencies belong inside the evaluator.

If an argument is itself an expression like `Data('referencePrefix')`,
its resolved value is not available at author time. Validate the
resolved value inside the evaluator instead.

---

## Chainable output

Generator expressions support the same chaining methods as
references: `.path()`, `.match()`, `.pipe()`, and `.each()`. This
means you can transform, test, and navigate generator output the
same way you would any other value in a definition.

### Piping

The most common use of chaining is piping a generator through
transformers:

```typescript
Generator.Date.Today().pipe(
  Transformer.Date.AddDays(30),
  Transformer.Date.Format('DD/MM/YYYY'),
)
```

Your custom generators work the same way:

```typescript
MyGenerators.NewReferenceNumber('REF').pipe(
  Transformer.String.ToUpperCase(),
)
```

### Matching

You can test a generator's output with `.match()`:

```typescript
visibleWhen: MyGenerators.FeatureFlag('showNewSection')
  .match(Condition.Equals(true))
```

---

## Registration

Pass the registry to a package through the `functions` property:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'

export default createForgePackage<MyDeps>({
  journey: myJourney,
  functions: myGenerators,
})
```

`functions` also accepts an array of registries when a package
mixes several function kinds:

```typescript
functions: [myGenerators, myTransformers],
```

Dependencies are injected at application startup:

```typescript
forge.registerPackage(myPackage, {
  sequenceService: services.sequenceService,
})
```

To make generators available to every journey rather than a single
package, register the registry globally instead:

```typescript
forge.registerGlobalFunctions(myGenerators, {
  sequenceService: services.sequenceService,
})
```

---

## Using custom generators

Custom generators can appear anywhere a dynamic value is accepted:
block properties, field defaults, `Format()` arguments, and more.

### Default values

```typescript
GovUKTextInput({
  code: 'referenceId',
  label: { text: 'Reference number' },
  defaultValue: MyGenerators.NewReferenceNumber('REF'),
})
```

### In Format

```typescript
GovUKBody({
  text: Format(
    'Your reference is %1.',
    MyGenerators.NewReferenceNumber('APP'),
  ),
})
```

### In block properties

```typescript
GovUKInsetText({
  text: MyGenerators.DisclaimerText('en'),
})
```

---

## Generators vs effects

Generators and effects can both produce values at runtime, but they
serve different purposes.

Use a **generator** when the value can be produced without side
effects. UUIDs, timestamps, computed defaults, and formatted
strings are all good candidates. Generators are pure functions.
They do not read answers, set data, or call APIs.

Use an **effect** when producing the value requires interacting
with external systems or the request context. Loading data from an
API, reading session state, or computing a value from multiple
answers are effect territory. Effects have access to the full
context object; generators do not.

If you find yourself wishing a generator could read an answer or
call an API, it should be an effect with `context.setData()`
instead.

---

## Testing

`register` returns an expression handle, not the underlying
function, so tests evaluate the generator through the registry's
`build` method. Call `build` with mock dependencies to get an
object keyed by name, then read the `evaluate` function:

```typescript
describe('MyGenerators', () => {
  describe('NewReferenceNumber', () => {
    const newReferenceNumber = myGenerators.build({} as MyDeps).NewReferenceNumber.evaluate

    it('should start with the given prefix', () => {
      // Arrange / Act
      const result = newReferenceNumber('REF')

      // Assert
      expect(result).toMatch(/^REF-/)
    })
  })

  describe('NextSequenceNumber', () => {
    it('should call the sequence service', () => {
      // Arrange
      const deps = {
        sequenceService: { next: jest.fn().mockReturnValue(42) },
      } as unknown as MyDeps

      const nextSequenceNumber = myGenerators.build(deps).NextSequenceNumber.evaluate

      // Act
      const result = nextSequenceNumber()

      // Assert
      expect(result).toBe(42)
      expect(deps.sequenceService.next).toHaveBeenCalled()
    })
  })
})
```

`build` returns the entry keyed by the name you registered, and
`evaluate` is the `(...args) => result` function itself. It
bypasses the schemas and `prepare`, so it exercises the evaluator
logic directly.

---

## Best practices

- **Keep generators pure.** A generator should produce a value
  without side effects. If it needs to read answers, set data, or
  interact with external services beyond simple value production,
  use an effect instead.
- **Use generators for values that belong inline.** Default values,
  computed properties, and formatted strings are good fits.
  Reference data that multiple blocks need is better loaded by an
  effect into `Data()`.
- **Return consistent types.** A generator that sometimes returns a
  string and sometimes returns a number makes pipeline chaining
  unpredictable. Pick a return type and stick with it.
- **Validate arguments early.** Use a `prepare` hook to catch
  configuration errors at module load, or an `argumentsSchema` to
  catch them at request time before the evaluator runs.
