---
title: Custom generators
section: building-functions-and-components
path: building-functions-and-components/custom-generators
teaches: [defineGeneratorFunctions, GeneratorFunctionExpr, custom-generator-shape, generator-implementation]
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

## The shape interface

The shape interface defines what each generator looks like in a
journey definition. Each property is a function that returns a
`GeneratorFunctionExpr`:

```typescript
import { GeneratorFunctionExpr } from '@ministryofjustice/hmpps-forge/core/authoring'

export interface MyGeneratorShape {
  /** Produces a new v4 UUID. */
  NewUUID: () => GeneratorFunctionExpr
  /**
   * Produces a unique reference number with the given prefix.
   * @param prefix - The string to prepend to the generated number.
   */
  NewReferenceNumber: (prefix: string) => GeneratorFunctionExpr
}
```

`NewUUID` takes no arguments. `NewReferenceNumber` takes a prefix
string. As with all custom functions, arguments can be static
values or expressions in the definition:

```typescript
defaultValue: MyGenerators.NewReferenceNumber('REF')
defaultValue: MyGenerators.NewReferenceNumber(Data('referencePrefix'))
```

---

## The implementation

`defineGeneratorFunctions` pairs the shape with implementations.
Each implementation follows the pattern
`(deps) => (...args) => result`:

```typescript
import { defineGeneratorFunctions } from '@ministryofjustice/hmpps-forge/core/authoring'

export const { generators: MyGenerators, implementations: myGeneratorImplementations } =
  defineGeneratorFunctions<MyGeneratorShape, MyDeps>({
    NewUUID: (deps) => () => {
      return crypto.randomUUID()
    },

    NewReferenceNumber: (deps) => (prefix: string) => {
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 6)

      return `${prefix}-${timestamp}-${random}`.toUpperCase()
    },
  })
```

The call returns two things:

- **`generators`** (here `MyGenerators`) is a builder object for
  use in journey definitions. `MyGenerators.NewUUID()` creates an
  expression that Forge evaluates at runtime.
- **`implementations`** (here `myGeneratorImplementations`) is an
  object containing the actual functions, ready to be registered in
  a package.

### How generators differ from transformers

Generators and transformers follow a similar pattern, but with one
key difference. A transformer receives a value as its first
parameter and reshapes it. A generator receives no value. It
produces something from nothing.

```typescript
// Transformer: (deps) => (value, ...args) => result
Slugify: (deps) => (value: unknown) => { ... }

// Generator: (deps) => (...args) => result
NewUUID: (deps) => () => { ... }
```

### The outer function: dependencies

The outer function `(deps) => ...` receives injected dependencies,
even if your generator does not need them. If it does need external
services, they are available through `deps`:

```typescript
NextSequenceNumber: (deps) => () => {
  return deps.sequenceService.next()
}
```

---

## Author-time preparation

Factory entries can also be written as `{ prepare, factory }`,
where `prepare` is an optional hook that runs synchronously when
the generator builder is called. Use it to sanitise or reshape
arguments before they enter the expression tree, and to reject
invalid arguments early — when the journey module loads rather
than at render time.

`prepare` receives the same arguments as the evaluator and returns
them as an array. The returned array replaces the original
arguments in the built expression.

```typescript
export const { generators: MyGenerators, implementations: myGeneratorImplementations } =
  defineGeneratorFunctions<MyGeneratorShape, MyDeps>({
    NewReferenceNumber: {
      prepare: (prefix: string): [string] => {
        if (typeof prefix !== 'string' || prefix.length === 0) {
          throw new Error('NewReferenceNumber requires a non-empty prefix')
        }

        return [prefix]
      },
      factory: (deps) => (prefix: string) => {
        const timestamp = Date.now().toString(36)
        const random = Math.random().toString(36).substring(2, 6)

        return `${prefix}-${timestamp}-${random}`.toUpperCase()
      },
    },
  })
```

A bad call fails as soon as the definition is imported:

```typescript
// Throws 'NewReferenceNumber requires a non-empty prefix'.
MyGenerators.NewReferenceNumber('')
```

Since generators have no injected first parameter, `prepare` sees
exactly what the author passed to the builder. Use it for
structural checks (required fields, numeric ranges, enum
membership) and for stripping properties that are not needed at
runtime. Checks that depend on injected dependencies belong inside
the evaluator.

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

Generator implementations are registered in a package through the
`functions` property:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'

export default createForgePackage<MyDeps>({
  journey: myJourney,
  functions: {
    ...myGeneratorImplementations,
  },
})
```

Dependencies are injected at application startup:

```typescript
forge.registerPackage(myPackage, {
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

Generator implementations are plain functions. Call the outer
function with mock dependencies, then call the inner function with
any arguments:

```typescript
describe('MyGenerators', () => {
  describe('NewReferenceNumber', () => {
    const newReferenceNumber = myGeneratorImplementations.NewReferenceNumber({} as MyDeps)

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

      const nextSequenceNumber = myGeneratorImplementations.NextSequenceNumber(deps)

      // Act
      const result = nextSequenceNumber()

      // Assert
      expect(result).toBe(42)
      expect(deps.sequenceService.next).toHaveBeenCalled()
    })
  })
})
```

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
- **Prepare arguments at author time.** Use the
  `{ prepare, factory }` form to sanitise arguments and catch
  configuration errors at module load rather than at render time.
