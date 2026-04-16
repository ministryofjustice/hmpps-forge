---
title: Custom conditions
section: building-functions-and-components
path: building-functions-and-components/custom-conditions
teaches: [defineConditionFunctions, ConditionFunctionExpr, custom-condition-shape, condition-implementation]
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

## The shape interface

The shape interface defines what each condition looks like in a
journey definition. Each property is a function that returns a
`ConditionFunctionExpr`:

```typescript
import { ConditionFunctionExpr } from '@ministryofjustice/hmpps-forge/core/authoring'

export interface MyConditionShape {
  /**
   * Checks that a numeric value meets the minimum score threshold.
   * @param minScore - The minimum value required for eligibility.
   */
  IsEligible: (minScore: number) => ConditionFunctionExpr
  /** Validates that the value is a correctly formatted UK National Insurance number. */
  IsValidNiNumber: () => ConditionFunctionExpr
  /**
   * Checks that a date string falls before the given deadline.
   * @param deadline - An ISO date string representing the cutoff date.
   */
  IsBeforeDeadline: (deadline: string) => ConditionFunctionExpr
}
```

`IsValidNiNumber` takes no arguments. `IsEligible` takes a minimum
score. Arguments declared in the shape can be static values or
expressions:

```typescript
// Static argument
Answer('score').match(MyConditions.IsEligible(50))

// Dynamic argument
Answer('score').match(MyConditions.IsEligible(Data('minimumScore')))
```

---

## The implementation

`defineConditionFunctions` pairs the shape with implementations.
Each implementation follows the pattern
`(deps) => (value, ...args) => boolean`:

```typescript
import { defineConditionFunctions } from '@ministryofjustice/hmpps-forge/core/authoring'

export const { conditions: MyConditions, implementations: myConditionImplementations } =
  defineConditionFunctions<MyConditionShape, MyDeps>({
    IsEligible: (deps) => (value: unknown, minScore: number) => {
      if (typeof value !== 'number') {
        throw new TypeError('IsEligible expects a number')
      }

      return value >= minScore
    },

    IsValidNiNumber: (deps) => (value: unknown) => {
      if (typeof value !== 'string') {
        throw new TypeError('IsValidNiNumber expects a string')
      }

      return /^[A-Z]{2}\d{6}[A-D]$/i.test(value.replace(/\s/g, ''))
    },

    IsBeforeDeadline: (deps) => (value: unknown, deadline: string) => {
      if (typeof value !== 'string') {
        throw new TypeError('IsBeforeDeadline expects a date string')
      }

      return new Date(value) < new Date(deadline)
    },
  })
```

The call returns two things:

- **`conditions`** (here `MyConditions`) is a builder object for
  use in journey definitions. `MyConditions.IsEligible(50)` creates
  a condition expression that Forge evaluates through `.match()`.
- **`implementations`** (here `myConditionImplementations`) is an
  object containing the actual functions, ready to be registered in
  a package.

### The value parameter

The first parameter of every condition implementation is the
resolved value from the reference it is matched against. When you
write `Answer('score').match(MyConditions.IsEligible(50))`, Forge
resolves `Answer('score')` to a concrete value and passes it as
the first argument to the implementation.

The value type is `unknown` because it depends on what the
reference resolves to at runtime. Always verify the type before
operating on it.

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

## Type checking with TypeError

Condition inputs are resolved at runtime. You cannot rely on the
TypeScript compiler to catch a mismatch between the reference type
and what the condition expects. Verify the type at the start of
your implementation.

```typescript
IsValidNiNumber: (deps) => (value: unknown) => {
  if (typeof value !== 'string') {
    throw new TypeError('IsValidNiNumber expects a string')
  }

  return /^[A-Z]{2}\d{6}[A-D]$/i.test(value.replace(/\s/g, ''))
}
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

Condition implementations are registered in a package through the
`functions` property:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'

export default createForgePackage<MyDeps>({
  journey: myJourney,
  functions: {
    ...myConditionImplementations,
  },
})
```

Dependencies are injected at application startup:

```typescript
forge.registerPackage(myPackage, {
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

Condition implementations are plain functions that return booleans.
Call the outer function with mock dependencies, then call the inner
function with a value and any arguments:

```typescript
describe('MyConditions', () => {
  describe('IsEligible', () => {
    const isEligible = myConditionImplementations.IsEligible({} as MyDeps)

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
    const isValidNiNumber = myConditionImplementations.IsValidNiNumber({} as MyDeps)

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

---

## Best practices

- **Write conditions in positive form.** Describe when the value
  *is* valid, not when it fails. The definition can always negate
  with `.not.match()`.
- **Verify the input type.** Throw `TypeError` for mismatches so
  Forge can surface configuration errors during development.
- **Keep conditions focused on a single check.** If a condition
  tests multiple things, split it into separate conditions and let
  the definition compose them with `and()`.
- **Use meaningful names.** `IsValidNiNumber` tells the reader
  what the condition checks. `ValidateFormat` does not.
- **Accept arguments for thresholds and boundaries.** A condition
  like `IsEligible(minScore)` is reusable across different
  contexts. A condition that hardcodes a threshold is not.
