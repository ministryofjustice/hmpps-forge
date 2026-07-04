---
title: Custom conditions
section: building-functions-and-components
path: building-functions-and-components/custom-conditions
teaches: [ConditionRegistry, register, inputSchema, argumentsSchema, condition-implementation]
prerequisites: [Condition, match-method, predicate, createForgePackage]
---

<p class="govuk-caption-xl">Functions</p>

# Building custom conditions

Forge ships with conditions for common checks: required fields,
string lengths, date ranges, array membership, and more. When your
application needs domain-specific validation or visibility logic,
you can define your own conditions. They work the same way as the
built-in set and can be used anywhere `.match()` is accepted.

{{slot:toc}}

---

## Declaring conditions

Custom conditions are declared through a `ConditionRegistry`. You
create one registry, register each condition on it, and group the
returned handles in a plain object for use in journey definitions:

```typescript
import { ConditionRegistry } from '@ministryofjustice/hmpps-forge/core/authoring'

const myConditions = new ConditionRegistry<MyDeps>()

export const MyConditions = {
  /**
   * Checks that a numeric value meets the minimum score threshold.
   * @param minScore - The minimum value required for eligibility.
   */
  IsEligible: myConditions.register(
    'IsEligible',
    (deps) => (value: unknown, minScore: number) => {
      if (typeof value !== 'number') {
        throw new TypeError('IsEligible expects a number')
      }

      return value >= minScore
    },
  ),

  /** Validates that the value is a correctly formatted UK National Insurance number. */
  IsValidNiNumber: myConditions.register(
    'IsValidNiNumber',
    (deps) => (value: unknown) => {
      if (typeof value !== 'string') {
        throw new TypeError('IsValidNiNumber expects a string')
      }

      return /^[A-Z]{2}\d{6}[A-D]$/i.test(value.replace(/\s/g, ''))
    },
  ),

  /**
   * Checks that a date string falls before the given deadline.
   * @param deadline - An ISO date string representing the cutoff date.
   */
  IsBeforeDeadline: myConditions.register(
    'IsBeforeDeadline',
    (deps) => (value: unknown, deadline: string) => {
      if (typeof value !== 'string') {
        throw new TypeError('IsBeforeDeadline expects a date string')
      }

      return new Date(value) < new Date(deadline)
    },
  ),
}
```

There is no separate shape interface to maintain. `register` infers
the argument types straight from the factory, so
`MyConditions.IsEligible` becomes `(minScore: number) => ConditionFunctionExpr`
and `MyConditions.IsValidNiNumber` becomes `() => ConditionFunctionExpr`.
The JSDoc on each grouped handle documents the condition the same
way a shape interface used to.

Each `register` call takes a name, an optional options object, and
a factory following the pattern `(deps) => (value, ...args) => boolean`.
It returns a callable handle. `MyConditions.IsEligible(50)` creates
a condition expression that Forge evaluates through `.match()`.

Arguments passed to a handle can be static values or expressions:

```typescript
// Static argument
Answer('score').match(MyConditions.IsEligible(50))

// Dynamic argument
Answer('score').match(MyConditions.IsEligible(Data('minimumScore')))
```

### The value parameter

The first parameter of every condition factory is the resolved
value from the reference it is matched against. When you write
`Answer('score').match(MyConditions.IsEligible(50))`, Forge resolves
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
Answer('date').not.match(MyConditions.IsBeforeDeadline('2026-12-31'))
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
import { ConditionRegistry } from '@ministryofjustice/hmpps-forge/core/authoring'

const myConditions = new ConditionRegistry<MyDeps>()

export const MyConditions = {
  /**
   * Checks that a numeric value meets the minimum score threshold.
   * @param minScore - The minimum value required for eligibility.
   */
  IsEligible: myConditions.register(
    'IsEligible',
    {
      inputSchema: z.number(),
      argumentsSchema: z.tuple([z.number().nonnegative()]),
    },
    (deps) => (value: number, minScore: number) => value >= minScore,
  ),
}
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
const myConditions = new ConditionRegistry<MyDeps>()

export const MyConditions = {
  IsEligible: myConditions.register(
    'IsEligible',
    {
      prepare: (minScore: number): [number] => {
        if (!Number.isInteger(minScore) || minScore < 0) {
          throw new Error('IsEligible requires a non-negative integer')
        }

        return [minScore]
      },
    },
    (deps) => (value: unknown, minScore: number) => {
      if (typeof value !== 'number') {
        throw new TypeError('IsEligible expects a number')
      }

      return value >= minScore
    },
  ),
}
```

A bad call fails as soon as the definition is imported:

```typescript
// Throws 'IsEligible requires a non-negative integer'.
MyConditions.IsEligible(-1)
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
IsValidNiNumber: myConditions.register(
  'IsValidNiNumber',
  (deps) => (value: unknown) => {
    if (typeof value !== 'string') {
      throw new TypeError('IsValidNiNumber expects a string')
    }

    return /^[A-Z]{2}\d{6}[A-D]$/i.test(value.replace(/\s/g, ''))
  },
),
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

Pass the registry to a package through the `functions` property:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'

export default createForgePackage<MyDeps>({
  journey: myJourney,
  functions: myConditions,
})
```

`functions` also accepts an array of registries when a package
mixes conditions, transformers, generators, and effects:

```typescript
functions: [myConditions, myTransformers, myEffects],
```

Dependencies are injected at application startup:

```typescript
forge.registerPackage(myPackage, {
  eligibilityService: services.eligibilityService,
})
```

To make conditions available to every journey rather than a single
package, register the registry globally instead:

```typescript
forge.registerGlobalFunctions(myConditions, {
  eligibilityService: services.eligibilityService,
})
```

---

## Using custom conditions

Custom conditions work the same way as built-in conditions. They
are used through `.match()` on references.

### In validation

```typescript
validWhen: [
  validation({
    condition: Self().match(MyConditions.IsValidNiNumber()),
    message: 'Enter a valid National Insurance number',
  }),
]
```

### In visibility

```typescript
GovUKInsetText({
  text: 'You are eligible for the programme.',
  visibleWhen: Answer('score').match(MyConditions.IsEligible(50)),
})
```

### In hooks

```typescript
access({
  when: Answer('submissionDate').not.match(
    MyConditions.IsBeforeDeadline(Data('deadline')),
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
    Self().match(MyConditions.IsValidNiNumber()),
  ),
  message: 'Enter a valid National Insurance number',
})
```

---

## Testing

`register` returns an expression handle, not the underlying
function, so tests evaluate the condition through the registry's
`build` method. Call `build` with mock dependencies to get an
object keyed by name, then read the `evaluate` function:

```typescript
describe('MyConditions', () => {
  describe('IsEligible', () => {
    const isEligible = myConditions.build({} as MyDeps).IsEligible.evaluate

    it('should return true when value meets minimum score', () => {
      // Arrange / Act / Assert
      expect(isEligible(75, 50)).toBe(true)
    })

    it('should return false when value is below minimum score', () => {
      // Arrange / Act / Assert
      expect(isEligible(30, 50)).toBe(false)
    })

    it('should return true when value equals minimum score', () => {
      // Arrange / Act / Assert
      expect(isEligible(50, 50)).toBe(true)
    })

    it('should throw TypeError when value is not a number', () => {
      // Arrange / Act / Assert
      expect(() => isEligible('fifty', 50)).toThrow(TypeError)
    })
  })

  describe('IsValidNiNumber', () => {
    const isValidNiNumber = myConditions.build({} as MyDeps).IsValidNiNumber.evaluate

    it('should return true for a valid NI number', () => {
      // Arrange / Act / Assert
      expect(isValidNiNumber('AB123456C')).toBe(true)
    })

    it('should return true when spaces are present', () => {
      // Arrange / Act / Assert
      expect(isValidNiNumber('AB 12 34 56 C')).toBe(true)
    })

    it('should return false for an invalid format', () => {
      // Arrange / Act / Assert
      expect(isValidNiNumber('12345')).toBe(false)
    })
  })
})
```

`build` returns the entry keyed by the name you registered, so
`myConditions.build(deps).IsEligible.evaluate` is the
`(value, ...args) => boolean` function itself. `evaluate` bypasses
the schemas and `prepare`, so it exercises the evaluator logic
directly.

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
