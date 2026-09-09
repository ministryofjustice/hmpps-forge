---
title: match()
slug: match
section: reference
path: reference/match
nav: Authoring API/Expressions
order: 41
description: Selects a value by testing a subject against multiple conditions
teaches: [match, expressions, branching, value-selection]
prerequisites: [step]
related:
  reference: when, conditional, condition
---

# `match()`

`match()` selects a value by testing a subject against multiple conditions. You give it
a value to test, add branches with conditions and results, and the first branch to
match wins.

```typescript
import { match } from '@ministryofjustice/hmpps-forge/core/authoring'

// Select a label based on a status value
match(Answer('status'))
  .branch(Condition.Equals('active'), 'Active')
  .branch(Condition.Equals('pending'), 'Pending')
  .otherwise('Unknown')

// Select a tag colour based on risk level
match(Data('riskLevel'))
  .branch(Condition.Equals('HIGH'), 'red')
  .branch(Condition.Equals('MEDIUM'), 'amber')
  .branch(Condition.Equals('LOW'), 'green')
```

`match()` produces a value, not a predicate. Use it wherever a `ResolvableValue` is
accepted - component properties, branch values in other expressions, or effect
arguments. For a simple true/false choice, [`when()`](./when) is shorter.

---

## Reference

### `match(subject)`

Creates a multi-branch value expression. The subject is tested against each branch's
condition in order. The first matching branch's value is the result.

```typescript
function match(subject: string | ResolvableValue): ChainableMatch
```

:::param
---
name: subject
type: "string | ResolvableValue"
required: true
---
The value to test. Accepts a string, a reference like `Answer('status')` or
`Data('riskLevel')`, or any other resolvable value.
:::

#### Returns

A `ChainableMatch` - an immutable builder with two methods:

- `.branch(condition, value)` - adds a branch. The condition is a `Condition.*` call
  or a combinator built with [`and()`](./and), [`or()`](./or), [`not()`](./not), or
  [`xor()`](./xor). The value is any `ResolvableValue`. Returns a new `ChainableMatch`,
  so you can add more branches.
- `.otherwise(value)` - sets the fallback value when no branch matches. Returns a new
  `ChainableMatch`.

Each method returns a new builder. A stored `match()` expression can be forked into
different chains without interference.

When no branch matches and no `.otherwise()` is set, the expression resolves to
`undefined`.

---

## Usage

### Return different values per condition

The most common use - map a value to one of several results:

```typescript
GovUKTag({
  text: match(Answer('applicationStatus'))
    .branch(Condition.Equals('submitted'), 'Submitted')
    .branch(Condition.Equals('in-review'), 'In review')
    .branch(Condition.Equals('approved'), 'Approved')
    .branch(Condition.Equals('rejected'), 'Rejected')
    .otherwise('Unknown'),
})
```

### Use combinator conditions in branches

Branch conditions accept combinator trees built with `and()`, `or()`, `not()`, and
`xor()`:

```typescript
match(Answer('referenceCode'))
  .branch(
    or(
      and(
        Condition.String.StartsWith('FT'),
        not(Condition.String.Contains('-')),
      ),
      Condition.Equals('LEGACY'),
    ),
    'Fast track referral',
  )
  .branch(Condition.String.StartsWith('ST'), 'Standard referral')
  .otherwise('Unknown referral type')
```

The conditions here are bare (without a subject). The `match()` subject is applied to
every condition leaf in the tree.

### Replace nested when() chains

`match()` is a flat alternative to deeply nested `when().then().else()` chains.
These two expressions produce the same result:

```typescript
// Nested when() chains
when(Data('tier').match(Condition.Equals('premium')))
  .then('Premium support')
  .else(
    when(Data('tier').match(Condition.Equals('standard')))
      .then('Standard support')
      .else('Basic support')
  )

// Flat match()
match(Data('tier'))
  .branch(Condition.Equals('premium'), 'Premium support')
  .branch(Condition.Equals('standard'), 'Standard support')
  .otherwise('Basic support')
```

Use `match()` when you have three or more branches. For two branches,
[`when()`](./when) or [`Conditional()`](./conditional) reads more clearly.

---

## Troubleshooting

### match() used where a predicate is expected

`match()` produces a value, not a predicate. You cannot use a `match()` expression
directly in `visibleWhen`, `validWhen`, or hook `when` properties. Those properties
expect a predicate - the result of `.match()` on a reference, or a combinator like
`and()` or `or()`.

```typescript
// This won't work - match() is a value, not a predicate
visibleWhen: match(Answer('role'))
  .branch(Condition.Equals('admin'), true)
  .otherwise(false)

// Use .match() on the reference instead
visibleWhen: Answer('role').match(Condition.Equals('admin'))
```
