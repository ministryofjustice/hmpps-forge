---
title: Conditions
section: authoring-language
path: authoring-language/conditions
teaches: [Condition, match-method, predicate]
prerequisites: [Answer, Self, Data, validation, visibleWhen, dependentWhen]
---

<p class="govuk-caption-xl">Functions</p>

# Conditions

Conditions are predicate functions that test a value and return
true or false. They are how Forge makes decisions: whether a field
is valid, whether a block is visible, whether a redirect should
fire. Forge ships with conditions for common checks, and you can
define your own.

{{slot:toc}}

---

## What is a condition?

A condition is a function that receives a value and returns a
boolean. It answers a question about the value: is it present? Is
it a valid email? Is it greater than 18? Conditions are always used
through `.match()` on a reference, which pairs the value with the
test.

```typescript
import { Condition } from '@ministryofjustice/hmpps-forge/core/authoring'

Answer('email').match(Condition.IsRequired())
Answer('age').match(Condition.Number.GreaterThan(18))
Self().match(Condition.String.HasMaxLength(200))
```

Conditions describe when something **is** valid, not when it is
invalid. The result of `.match()` is a predicate expression that
evaluates to `true` when the condition passes. To express the
opposite, use `.not.match()`:

```typescript
Answer('date').not.match(Condition.Date.IsFutureDate())
```

### Where conditions are used

Conditions appear anywhere Forge needs a boolean decision:

- **`validWhen`** on fields and steps, to define validation rules
- **`visibleWhen`** on blocks, to control rendering
- **`dependentWhen`** on fields, to control validation and value
  retention
- **`when`** on hooks, redirects, and error outcomes, to control
  execution

The condition itself does not know which context it is used in. It
just tests a value. The context determines what happens with the
result.

---

## How it works

When Forge evaluates `Answer('email').match(Condition.IsRequired())`,
two things happen:

1. The reference is resolved to a concrete value
2. The condition function receives that value and returns `true` or
   `false`

Condition arguments can be static values or expressions. A static
argument like `Condition.Number.GreaterThan(18)` bakes the value
in. A dynamic argument like
`Condition.Equals(Answer('otherField'))` resolves the argument at
evaluation time, so the comparison value can change between
requests.

```typescript
// Static: always compared against 18
Answer('age').match(Condition.Number.GreaterThan(18))

// Dynamic: compared against whatever the user entered for minAge
Answer('age').match(Condition.Number.GreaterThan(Answer('minAge')))
```

---

## Using in your definitions

### Validation

The most common use. Each rule pairs a condition with an error
message:

```typescript
GovUKTextInput({
  code: 'fullName',
  label: { text: 'Full name' },
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your full name',
    }),
    validation({
      condition: Self().match(Condition.String.HasMaxLength(200)),
      message: 'Full name must be 200 characters or less',
    }),
    validation({
      condition: Self().match(Condition.String.LettersWithSpaceDashApostrophe()),
      message: 'Full name must only include letters, spaces, hyphens and apostrophes',
    }),
  ],
})
```

### Conditional visibility

Show or hide blocks based on a condition:

```typescript
GovUKTextInput({
  code: 'phoneNumber',
  label: { text: 'Phone number' },
  visibleWhen: Answer('contactMethod').match(Condition.Equals('phone')),
  dependentWhen: Answer('contactMethod').match(Condition.Equals('phone')),
})
```

### Hook guards

Control which hooks run:

```typescript
access({
  when: Params('areaOfNeed').not.match(
    Condition.Array.IsIn(Data('validAreas')),
  ),
  next: [redirect({ goto: '/not-found' })],
})
```

### Composing conditions

Conditions can be combined with `and`, `or`, `not`, and `xor`:

```typescript
import { and, or, not } from '@ministryofjustice/hmpps-forge/core/authoring'

// Both must be true
and(
  Self().match(Condition.Date.IsValid()),
  Self().not.match(Condition.Date.IsFutureDate()),
)

// At least one must be true
or(
  Answer('email').match(Condition.IsRequired()),
  Answer('phone').match(Condition.IsRequired()),
)

// Invert a condition
not(Answer('status').match(Condition.Equals('closed')))
```

These combinators are covered in more detail on the
[Matching and combinators](combinators) page.

---

## Custom conditions

When you need domain-specific validation or visibility logic that
the built-in set does not cover, you can define your own
conditions. They are used through `.match()` on references in
exactly the same way as built-ins.

See [Building custom conditions](../building-functions-and-components/custom-conditions)
for the shape interface, implementation, type-checking conventions,
and registration details.

---

## API surface

### `.match(condition)`

Tests a reference's resolved value against a condition. Returns a
predicate expression.

```typescript
Answer('email').match(Condition.IsRequired())
```

### `.not.match(condition)`

Negates the condition. Returns `true` when the condition fails.

```typescript
Answer('date').not.match(Condition.Date.IsFutureDate())
```

---

## Best practices

- **Write conditions in positive form.** Describe when the field
  *is* valid, not when it is invalid. Use `.not.match()` only when
  there is no positive-form condition available.
- **Use dynamic arguments for cross-field comparisons.**
  `Condition.Equals(Answer('otherField'))` resolves the argument at
  evaluation time, keeping the condition reactive.

---

## Built-in conditions

For the full reference of every built-in condition with detailed
descriptions and examples, see the Forge Core package pages:

- [General conditions](/forge-developer-guide/packages/forge-core/conditions-general) - `IsRequired`, `Equals`
- [String conditions](/forge-developer-guide/packages/forge-core/conditions-string) - length, pattern matching, character sets
- [Number conditions](/forge-developer-guide/packages/forge-core/conditions-number) - comparisons, ranges, type checks
- [Date conditions](/forge-developer-guide/packages/forge-core/conditions-date) - validity, comparisons, past/future
- [Array conditions](/forge-developer-guide/packages/forge-core/conditions-array) - membership, containment
- [Object conditions](/forge-developer-guide/packages/forge-core/conditions-object) - structure, property checks
- [Email conditions](/forge-developer-guide/packages/forge-core/conditions-email) - format validation
- [Phone conditions](/forge-developer-guide/packages/forge-core/conditions-phone) - UK and international
- [Address conditions](/forge-developer-guide/packages/forge-core/conditions-address) - postcode validation
