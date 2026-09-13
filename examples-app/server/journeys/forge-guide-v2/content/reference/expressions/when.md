---
title: when()
slug: when
section: reference
path: reference/when
nav: Authoring API/Expressions
order: 42
description: Creates a conditional value expression with a fluent builder
teaches: [when, expressions, conditional, value-selection]
prerequisites: [step]
related:
  reference: conditional, match, answer
---

# `when()`

`when()` creates a conditional value expression. You give it a predicate, then chain
`.then()` for the true value and `.else()` for the false value.

```typescript
import { when } from '@ministryofjustice/hmpps-forge/core/authoring'

// Choose a label based on a condition
when(Answer('country').match(Condition.Equals('UK')))
  .then('Postcode')
  .else('ZIP code')

// Pick a reference based on a flag
when(Answer('useNickname').match(Condition.Equals(true)))
  .then(Answer('nickname'))
  .else(Answer('firstName'))

// Boolean from a predicate (defaults: then = true, else = false)
when(Answer('age').match(Condition.Number.GreaterThan(18)))
```

`when()` produces a value, not a predicate. Use it wherever a `ResolvableValue` is
accepted - component properties, branch values, or effect arguments. For the same logic
in object syntax, see [`Conditional()`](./conditional). For three or more branches,
[`match()`](./match) is flatter.

---

## Reference

### `when(predicate)`

Creates a conditional value expression from a predicate.

```typescript
function when(predicate: PredicateExpr): ChainableConditional
```

:::param
---
name: predicate
type: "PredicateExpr"
required: true
---
The condition to evaluate. This is what `.match()` on a reference produces - for
example, `Answer('status').match(Condition.Equals('active'))`. Combinator expressions
built with [`and()`](./and), [`or()`](./or), [`not()`](./not), and [`xor()`](./xor)
are also accepted.
:::

#### Returns

A `ChainableConditional` - an immutable builder with two methods:

- `.then(value)` - sets the value to use when the predicate is true. Accepts any
  `ResolvableValue`: strings, numbers, booleans, references, or nested expressions.
  Returns a new `ChainableConditional`.
- `.else(value)` - sets the value to use when the predicate is false. Same types as
  `.then()`. Returns a new `ChainableConditional`.

Each method returns a new builder. A stored `when()` expression can be forked into
different chains without interference.

When `.then()` is not called, the true value defaults to `true`. When `.else()` is
not called, the false value defaults to `false`. A bare `when(predicate)` with no
chain acts as a boolean of that predicate.

---

## Usage

### Choose between two values

```typescript
GovUKTextInput({
  code: 'postalCode',
  label: when(Answer('country').match(Condition.Equals('UK')))
    .then('What is your postcode?')
    .else('What is your ZIP code?'),
})
```

### Use references as branch values

Branch values accept references and other expressions, not just strings:

```typescript
GovUKHeading({
  text: when(Answer('useNickname').match(Condition.Equals(true)))
    .then(Answer('nickname'))
    .else(Answer('firstName')),
})
```

### Nest when() for multiple branches

Chain `.else()` with another `when()` to handle more cases:

```typescript
text: when(Data('riskLevel').match(Condition.Equals('HIGH')))
  .then('High risk')
  .else(
    when(Data('riskLevel').match(Condition.Equals('MEDIUM')))
      .then('Medium risk')
      .else('Low risk')
  )
```

For three or more branches, [`match()`](./match) produces the same result with a
flatter structure.

### Produce a boolean from a compound predicate

With no `.then()` or `.else()`, the expression defaults to `true` when the predicate
matches and `false` when it does not:

```typescript
isComplete: when(
  and(
    Answer('name').match(Condition.IsRequired()),
    Answer('email').match(Condition.IsRequired()),
  )
)
```

This is useful when you need a boolean value from a combined predicate.

---

## Troubleshooting

### when() used where a predicate is expected

`when()` produces a value expression, not a predicate. You cannot pass a `when()`
expression to `visibleWhen`, `validWhen`, or hook `when` properties. Those properties
expect a predicate - the result of `.match()` on a reference, or a combinator like
`and()`.

The `when` in `when: Answer('x').match(...)` on a hook is a property name that accepts
a predicate directly. The standalone `when()` function is a different concept - it
builds a value.

### Deeply nested when() chains

If you have three or more levels of nesting, consider [`match()`](./match) instead.
It produces the same result with a flat list of branches:

```typescript
// Three levels deep - hard to read
when(pred1).then('A').else(when(pred2).then('B').else(when(pred3).then('C').else('D')))

// Flat match() - same result
match(subject)
  .branch(cond1, 'A')
  .branch(cond2, 'B')
  .branch(cond3, 'C')
  .otherwise('D')
```
