---
title: Custom generators
section: building-functions-and-components
path: building-functions-and-components/custom-generators
teaches: [generator, GeneratorRegistry, register, argumentsSchema, generator-implementation]
prerequisites: [Generator, pipe, createForgePackage]
---

<p class="govuk-caption-xl">Functions</p>

# Building custom generators

Generators produce values at runtime. The built-in generators
cover dates, but your application might need UUIDs, reference
numbers, or computed defaults. Custom generators let you define
any value-producing function and use it in your definitions the
same way you use `Generator.Date.Today()`. A custom generator is
declared with `generator()`, and using it in a journey registers
it automatically.

{{slot:toc}}

---

## Declaring generators

`generator()` takes a name and an options object containing the
factory. It returns a callable handle you use directly in journey
definitions:

```typescript
import { generator } from '@ministryofjustice/hmpps-forge/core/authoring'

/** Produces a new v4 UUID. */
export const NewUUID = generator('NewUUID', {
  factory: () => () => crypto.randomUUID(),
})

/**
 * Produces a unique reference number with the given prefix.
 * @param prefix - The string to prepend to the generated number.
 */
export const NewReferenceNumber = generator('NewReferenceNumber', {
  factory: () => (prefix: string) => {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 6)

    return `${prefix}-${timestamp}-${random}`.toUpperCase()
  },
})
```

There is no registry to create and no shape interface to maintain.
The factory follows the pattern `(deps) => (...args) => result`,
and the argument types come straight from it: `NewReferenceNumber`
is `(prefix) => GeneratorBuilder` and `NewUUID` is
`() => GeneratorBuilder`. `NewUUID()` creates an expression that
Forge evaluates at runtime.

As with all custom functions, arguments passed to a handle can be
static values or expressions. Each parameter automatically accepts
an expression as well as the type the factory declares - there is
no widening to do - and Forge resolves the expression before the
evaluator runs:

```typescript
defaultValue: NewReferenceNumber('REF')
defaultValue: NewReferenceNumber(Data('referencePrefix'))
```

Using the handle anywhere in a journey definition is also what
registers it. At `registerPackage()`, Forge collects every entry
the journey uses and registers its evaluator - there is nothing to
list on the package.

### How generators differ from transformers

Generators and transformers follow a similar pattern, but with one
key difference. A transformer receives a value as its first
parameter and reshapes it. A generator receives no value. It
produces something from nothing.

```typescript
// Transformer: (deps) => (value, ...args) => result
export const Slugify = transformer('Slugify', {
  factory: () => (value: unknown) => { ... },
})

// Generator: (deps) => (...args) => result
export const NewUUID = generator('NewUUID', {
  factory: () => () => { ... },
})
```

### The outer function: dependencies

The outer function `(deps) => ...` receives injected dependencies,
even if your generator does not need them. If it does need external
services, pass the dependency type as a type argument and read them
through `deps`:

```typescript
export const NextSequenceNumber = generator<MyDeps>('NextSequenceNumber', {
  factory: (deps) => () => deps.sequenceService.next(),
})
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
import { generator } from '@ministryofjustice/hmpps-forge/core/authoring'

/**
 * Produces a unique reference number with the given prefix.
 * @param prefix - The string to prepend to the generated number.
 */
export const NewReferenceNumber = generator('NewReferenceNumber', {
  argumentsSchema: z.tuple([z.string().min(1)]),
  factory: () => (prefix: string) => {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 6)

    return `${prefix}-${timestamp}-${random}`.toUpperCase()
  },
})
```

The `argumentsSchema` catches an author passing an empty prefix.
A failed schema throws a `TypeError` at request time, when the
generator is evaluated — not when the journey module loads.

Argument-count mismatches against a tuple schema are additionally caught at `registerPackage()` by semantic analysis, so a call with the wrong number of arguments fails compilation instead of waiting for request time.

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
export const NewReferenceNumber = generator('NewReferenceNumber', {
  prepare: (prefix: string): [string] => {
    if (typeof prefix !== 'string' || prefix.length === 0) {
      throw new Error('NewReferenceNumber requires a non-empty prefix')
    }

    return [prefix]
  },
  factory: () => (prefix: string) => {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 6)

    return `${prefix}-${timestamp}-${random}`.toUpperCase()
  },
})
```

A bad call fails as soon as the definition is imported:

```typescript
// Throws 'NewReferenceNumber requires a non-empty prefix'.
NewReferenceNumber('')
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

Generator expressions support `.pipe()`, `.match()`, and
`.not.match()`. This means you can transform and test generator
output the same way you would any other value in a definition.

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
NewReferenceNumber('REF').pipe(
  Transformer.String.ToUpperCase(),
)
```

### Matching

You can test a generator's output with `.match()`:

```typescript
visibleWhen: FeatureFlag('showNewSection')
  .match(Condition.Equals(true))
```

---

## Registration

Using a generator in a journey definition registers it - there is
nothing to declare on the package. Dependencies are injected at
application startup when you register the package, and every
entry's factory receives them:

```typescript
forge.registerPackage(myPackage, {
  sequenceService: services.sequenceService,
})
```

If a journey refers to a generator only by name - a journey defined
in JSON, for example - nothing uses the handle, so there is nothing
to collect. List the entry on the package's `functions` property to
register it under its declared name regardless:

```typescript
export default createForgePackage<MyDeps>({
  journey: myJourney,
  functions: [NewUUID, NewReferenceNumber],
})
```

The `functions` array mixes entries and registries freely. To make
generators available to every journey rather than a single package,
group them on a registry and register it globally - see
[Grouping with a registry](#grouping-with-a-registry).

---

## Using custom generators

Custom generators can appear anywhere a dynamic value is accepted:
block properties, field defaults, `Format()` arguments, and more.

### Default values

```typescript
GovUKTextInput({
  code: 'referenceId',
  label: { text: 'Reference number' },
  defaultValue: NewReferenceNumber('REF'),
})
```

### In Format

```typescript
GovUKBody({
  text: Format(
    'Your reference is %1.',
    NewReferenceNumber('APP'),
  ),
})
```

### In block properties

```typescript
GovUKInsetText({
  text: DisclaimerText('en'),
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

Test a generator with `FunctionRegistryTestHarness` from the
testing module. Pass the entry to the constructor, then evaluate
the expression the handle builds. Generators take no injected
input, so `evaluate` runs them immediately. The harness runs the
engine's real evaluation pipeline - schemas and output validation
included - so a wrong schema fails in your tests rather than
shipping silently:

```typescript
import { FunctionRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'

describe('NewReferenceNumber', () => {
  const harness = new FunctionRegistryTestHarness(NewReferenceNumber)

  it('should start with the given prefix', () => {
    // Arrange / Act
    const result = harness.evaluate(NewReferenceNumber('REF'))

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

    const harness = new FunctionRegistryTestHarness(NextSequenceNumber, deps)

    // Act
    const result = harness.evaluate(NextSequenceNumber())

    // Assert
    expect(result).toBe(42)
    expect(deps.sequenceService.next).toHaveBeenCalled()
  })
})
```

---

## Grouping with a registry

Entries suit generators that live alongside the journeys using
them. When a package exposes a family of generators as a shared
API - or when generators must be available to every journey - a
`GeneratorRegistry` groups them under one handle object:

```typescript
import { GeneratorRegistry } from '@ministryofjustice/hmpps-forge/core/authoring'

const myGenerators = new GeneratorRegistry<MyDeps>()

export const MyGenerators = {
  /** Produces a new v4 UUID. */
  NewUUID: myGenerators.register('NewUUID', () => () => crypto.randomUUID()),
}
```

`register` takes the same options (`argumentsSchema`,
`outputSchema`, `prepare`) and the same factory shape, and returns
the same kind of callable handle. Two differences from entries:

- Nothing registers automatically. Pass the registry to a package's
  `functions` property, or globally:

  ```typescript
  forge.registerGlobalFunctions(myGenerators, {
    sequenceService: services.sequenceService,
  })
  ```

- Handle parameters accept only the types the factory declares. To
  accept expressions too, widen the parameter to
  `string | ResolvableValue` (exported from
  `@ministryofjustice/hmpps-forge/core/authoring`).

`FunctionRegistryTestHarness` accepts a registry in place of an
entry, so the testing pattern above works unchanged.

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
