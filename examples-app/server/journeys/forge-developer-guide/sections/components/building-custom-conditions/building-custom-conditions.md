---
title: Custom conditions
section: building-functions-and-components
path: building-functions-and-components/custom-conditions
teaches: [condition, ConditionRegistry, register, inputSchema, argumentsSchema, condition-implementation]
prerequisites: [Condition, match-method, predicate, createForgePackage]
---

<p class="govuk-caption-xl">Functions</p>

# Building custom conditions

Forge ships with conditions for common checks: required fields,
string lengths, date ranges, array membership, and more. When your
application needs domain-specific validation or visibility logic,
you can define your own conditions. A custom condition is declared
with `condition()`, using it in a journey registers it
automatically, and it works anywhere `.match()` is accepted.

{{slot:toc}}

---

## Declaring conditions

`condition()` takes a name and an options object containing the
factory. It returns a callable handle you use directly in journey
definitions:

```typescript
import { condition } from '@ministryofjustice/hmpps-forge/core/authoring'

/**
 * Checks that a numeric value meets the minimum score threshold.
 * @param minScore - The minimum value required for eligibility.
 */
export const IsEligible = condition('IsEligible', {
  factory: () => (value: unknown, minScore: number) => {
    if (typeof value !== 'number') {
      throw new TypeError('IsEligible expects a number')
    }

    return value >= minScore
  },
})

/** Validates that the value is a correctly formatted UK National Insurance number. */
export const IsValidNiNumber = condition('IsValidNiNumber', {
  factory: () => (value: unknown) => {
    if (typeof value !== 'string') {
      throw new TypeError('IsValidNiNumber expects a string')
    }

    return /^[A-Z]{2}\d{6}[A-D]$/i.test(value.replace(/\s/g, ''))
  },
})

/**
 * Checks that a date string falls before the given deadline.
 * @param deadline - An ISO date string representing the cutoff date.
 */
export const IsBeforeDeadline = condition('IsBeforeDeadline', {
  factory: () => (value: unknown, deadline: string) => {
    if (typeof value !== 'string') {
      throw new TypeError('IsBeforeDeadline expects a date string')
    }

    return new Date(value) < new Date(deadline)
  },
})
```

There is no registry to create and no shape interface to maintain.
The factory follows the pattern `(deps) => (value, ...args) => boolean`,
and the argument types come straight from it: `IsEligible` is
`(minScore) => ConditionFunctionExpr` and `IsValidNiNumber` is
`() => ConditionFunctionExpr`. `IsEligible(50)` creates a condition
expression that Forge evaluates through `.match()`.

Arguments passed to a handle can be static values or expressions.
Each parameter automatically accepts an expression as well as the
type the factory declares - there is no widening to do - and Forge
resolves the expression before the evaluator runs:

```typescript
// Static argument
Answer('score').match(IsEligible(50))

// Dynamic argument
Answer('score').match(IsEligible(Data('minimumScore')))
```

Using the handle anywhere in a journey definition is also what
registers it. At `registerPackage()`, Forge collects every entry
the journey uses and registers its evaluator - there is nothing to
list on the package.

### The value parameter

The first parameter of every condition factory is the resolved
value from the reference it is matched against. When you write
`Answer('score').match(IsEligible(50))`, Forge resolves
`Answer('score')` to a concrete value and passes it as the first
argument to the evaluator.

The value type is `unknown` because it depends on what the
reference resolves to at runtime. Verify the type before operating
on it, or declare an `inputSchema` (see below) to have Forge check
it for you.

### Return value

Conditions must return a boolean. `true` means the condition
passes. `false` means it fails. Forge uses this result directly
for validation, visibility, and hook guards.

Conditions describe when something **is** valid, not when it is
invalid. This keeps the logic consistent across `validWhen`,
`visibleWhen`, and `dependentWhen`. To test for the opposite, the
definition uses `.not.match()`:

```typescript
Answer('date').not.match(IsBeforeDeadline('2026-12-31'))
```

---

## Validating inputs and arguments

The options object accepts Zod schemas that Forge applies before
your evaluator runs. This is the declarative alternative to manual
`typeof` checks:

- **`inputSchema`** validates the resolved value.
- **`argumentsSchema`** validates the author-supplied arguments. It
  is a `z.tuple` describing each positional argument.
- **`outputSchema`** validates the return value. Conditions default
  to `z.boolean()`, so you rarely need to set this.

```typescript
import { z } from 'zod'
import { condition } from '@ministryofjustice/hmpps-forge/core/authoring'

/**
 * Checks that a numeric value meets the minimum score threshold.
 * @param minScore - The minimum value required for eligibility.
 */
export const IsEligible = condition('IsEligible', {
  inputSchema: z.number(),
  argumentsSchema: z.tuple([z.number().nonnegative()]),
  factory: () => (value: number, minScore: number) => value >= minScore,
})
```

With `inputSchema: z.number()` in place, a non-numeric value never
reaches the evaluator — the condition simply evaluates to `false`.
An unanswered or wrongly-shaped field is a normal "not valid yet"
outcome for a condition, not a bug, so it fails soft. That lets the
factory type its value parameter as `number` and drop the manual
`typeof` guard.

A failed `argumentsSchema` is different: passing a negative
threshold is an author mistake, so Forge throws a `TypeError` when
the condition is evaluated.

Schemas run at request time, each time the condition is evaluated —
not when the journey module loads.

Argument-count mismatches against a tuple schema are additionally caught at `registerPackage()` by semantic analysis, so a call with the wrong number of arguments fails compilation instead of waiting for request time.

---

## Author-time preparation

The options object also accepts a `prepare` hook that runs
synchronously when the condition handle is called. Use it to
sanitise or reshape arguments before they enter the expression
tree, and to reject invalid arguments early — when the journey
module loads rather than at render time.

`prepare` receives only the arguments the author passed to the
handle and returns them as an array. The returned array replaces
the original arguments in the built expression.

```typescript
export const IsEligible = condition('IsEligible', {
  prepare: (minScore: number): [number] => {
    if (!Number.isInteger(minScore) || minScore < 0) {
      throw new Error('IsEligible requires a non-negative integer')
    }

    return [minScore]
  },
  factory: () => (value: unknown, minScore: number) => {
    if (typeof value !== 'number') {
      throw new TypeError('IsEligible expects a number')
    }

    return value >= minScore
  },
})
```

A bad call fails as soon as the definition is imported:

```typescript
// Throws 'IsEligible requires a non-negative integer'.
IsEligible(-1)
```

`prepare` does not see injected dependencies or the runtime value,
so it can only check structural properties of the arguments:
required fields, numeric ranges, enum membership, or combinations
like `min <= max`. Checks that depend on the resolved value belong
inside the evaluator.

If an argument is itself an expression like `Data('minimumScore')`,
its resolved value is not available at author time. Validate the
resolved value inside the evaluator instead.

`argumentsSchema` and `prepare` overlap: a schema validates
arguments, `prepare` can both validate and reshape them. They also
run at different times — `prepare` runs once, when the definition
is built at module load; `argumentsSchema` runs at request time,
each time the condition is evaluated. Reach for `argumentsSchema`
when you only need to check the arguments, and `prepare` when you
need to transform them or fail as early as possible.

---

## Type checking with TypeError

Condition inputs are resolved at runtime. You cannot rely on the
TypeScript compiler to catch a mismatch between the reference type
and what the condition expects. When you have not declared an
`inputSchema`, verify the type at the start of your evaluator.

```typescript
export const IsValidNiNumber = condition('IsValidNiNumber', {
  factory: () => (value: unknown) => {
    if (typeof value !== 'string') {
      throw new TypeError('IsValidNiNumber expects a string')
    }

    return /^[A-Z]{2}\d{6}[A-D]$/i.test(value.replace(/\s/g, ''))
  },
})
```

Forge treats `TypeError` differently depending on context:

- **Outside validation** (in `visibleWhen`, `dependentWhen`, hook
  guards), a `TypeError` immediately surfaces as a configuration
  error. This makes mismatches obvious during development.
- **Inside `validWhen`**, a `TypeError` is caught and treated as a
  validation failure. This is safe because the field will show an
  error message and the user can correct their input.

Use `TypeError` specifically, not `Error`, so Forge can distinguish
type mismatches from other failures.

---

## Registration

Using a condition in a journey definition registers it - there is
nothing to declare on the package. Dependencies are injected at
application startup when you register the package, and every
entry's factory receives them:

```typescript
forge.registerPackage(myPackage, {
  eligibilityService: services.eligibilityService,
})
```

If a journey refers to a condition only by name - a journey defined
in JSON, for example - nothing uses the handle, so there is nothing
to collect. List the entry on the package's `functions` property to
register it under its declared name regardless:

```typescript
export default createForgePackage<MyDeps>({
  journey: myJourney,
  functions: [IsEligible, IsValidNiNumber],
})
```

The `functions` array mixes entries and registries freely. To make
conditions available to every journey rather than a single package,
group them on a registry and register it globally - see
[Grouping with a registry](#grouping-with-a-registry).

---

## Using custom conditions

Custom conditions work the same way as built-in conditions. They
are used through `.match()` on references.

### In validation

```typescript
validWhen: [
  validation({
    condition: Self().match(IsValidNiNumber()),
    message: 'Enter a valid National Insurance number',
  }),
]
```

### In visibility

```typescript
GovUKInsetText({
  text: 'You are eligible for the programme.',
  visibleWhen: Answer('score').match(IsEligible(50)),
})
```

### In hooks

```typescript
access({
  when: Answer('submissionDate').not.match(
    IsBeforeDeadline(Data('deadline')),
  ),
  next: [redirect({ goto: '/deadline-passed' })],
})
```

### With combinators

Custom conditions compose with `and`, `or`, `not`, and `xor` the
same way built-in conditions do:

```typescript
validation({
  condition: and(
    Self().match(Condition.IsRequired()),
    Self().match(IsValidNiNumber()),
  ),
  message: 'Enter a valid National Insurance number',
})
```

---

## Testing

Test a condition with `FunctionRegistryTestHarness` from the
testing module. Pass the entry to the constructor, then evaluate
the expression the handle builds. The harness runs the engine's
real evaluation pipeline - schemas, short-circuits, and output
validation - so a wrong schema fails in your tests rather than
shipping silently:

```typescript
import { FunctionRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'

describe('IsEligible', () => {
  const harness = new FunctionRegistryTestHarness(IsEligible)

  it('should return true when value meets minimum score', () => {
    // Arrange / Act / Assert
    expect(harness.evaluate(IsEligible(50)).withInput(75)).toBe(true)
  })

  it('should return false when value is below minimum score', () => {
    // Arrange / Act / Assert
    expect(harness.evaluate(IsEligible(50)).withInput(30)).toBe(false)
  })

  it('should return true when value equals minimum score', () => {
    // Arrange / Act / Assert
    expect(harness.evaluate(IsEligible(50)).withInput(50)).toBe(true)
  })

  it('should throw TypeError when value is not a number', () => {
    // Arrange / Act / Assert
    expect(() => harness.evaluate(IsEligible(50)).withInput('fifty')).toThrow(TypeError)
  })
})

describe('IsValidNiNumber', () => {
  const harness = new FunctionRegistryTestHarness(IsValidNiNumber)

  it('should return true for a valid NI number', () => {
    // Arrange / Act / Assert
    expect(harness.evaluate(IsValidNiNumber()).withInput('AB123456C')).toBe(true)
  })

  it('should return false for an invalid format', () => {
    // Arrange / Act / Assert
    expect(harness.evaluate(IsValidNiNumber()).withInput('12345')).toBe(false)
  })
})
```

`withInput` supplies the value the engine would resolve from the
reference at runtime; the arguments come from the handle call. If
the condition depends on an external service, pass a stub as the
second constructor argument.

---

## Grouping with a registry

Entries suit conditions that live alongside the journeys using
them. When a package exposes a family of conditions as a shared
API - or when conditions must be available to every journey - a
`ConditionRegistry` groups them under one handle object:

```typescript
import { ConditionRegistry } from '@ministryofjustice/hmpps-forge/core/authoring'

const myConditions = new ConditionRegistry<MyDeps>()

export const MyConditions = {
  /** Validates that the value is a correctly formatted UK National Insurance number. */
  IsValidNiNumber: myConditions.register('IsValidNiNumber', () => (value: unknown) => {
    // same evaluator as the entry form
  }),
}
```

`register` takes the same options (`inputSchema`, `argumentsSchema`,
`outputSchema`, `prepare`) and the same factory shape, and returns
the same kind of callable handle. Two differences from entries:

- Nothing registers automatically. Pass the registry to a package's
  `functions` property, or globally:

  ```typescript
  forge.registerGlobalFunctions(myConditions, {
    eligibilityService: services.eligibilityService,
  })
  ```

- Handle parameters accept only the types the factory declares. To
  accept expressions too, widen the parameter to
  `number | ResolvableValue` (exported from
  `@ministryofjustice/hmpps-forge/core/authoring`) - the built-in
  conditions do the same.

`FunctionRegistryTestHarness` accepts a registry in place of an
entry, so the testing pattern above works unchanged.

---

## Best practices

- **Write conditions in positive form.** Describe when the value
  *is* valid, not when it fails. The definition can always negate
  with `.not.match()`.
- **Declare an `inputSchema` or throw `TypeError`.** The resolved
  value is `unknown`. Let a schema check it, or guard it and throw
  `TypeError` so Forge can surface configuration errors during
  development.
- **Keep conditions focused on a single check.** If a condition
  tests multiple things, split it into separate conditions and let
  the definition compose them with `and()`.
- **Use meaningful names.** `IsValidNiNumber` tells the reader
  what the condition checks. `ValidateFormat` does not.
- **Accept arguments for thresholds and boundaries.** A condition
  like `IsEligible(minScore)` is reusable across different
  contexts. A condition that hardcodes a threshold is not.
- **Validate arguments early.** Use a `prepare` hook to catch
  configuration errors at module load, or an `argumentsSchema` to
  catch them at request time before the evaluator runs.
