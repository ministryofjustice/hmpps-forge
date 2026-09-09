---
title: not()
slug: not
section: reference
path: reference/not
nav: Authoring API/Expressions
order: 47
description: Negates a predicate expression
teaches: [not, expressions, logic, predicates, negation]
prerequisites: [step]
related:
  reference: and, or, xor, answer
---

# `not()`

`not()` negates a predicate. The result is true when the original predicate is false,
and false when it is true.

```typescript
import { not } from '@ministryofjustice/hmpps-forge/core/authoring'

// Negate a single predicate
visibleWhen: not(Answer('isComplete').match(Condition.Equals(true)))

// Negate a compound predicate
visibleWhen: not(
  and(
    Answer('step1').match(Condition.Equals('done')),
    Answer('step2').match(Condition.Equals('done')),
  )
)

// Negate a bare condition inside a match() branch
match(Answer('code'))
  .branch(not(Condition.String.Contains('-')), 'No hyphen')
```

`not()` wraps any predicate, including compound ones built with [`and()`](./and), [`or()`](./or), and
[`xor()`](./xor). For inline negation of a single condition on one reference, the `.not`
property on references is shorter - see the comparison below.

---

## Reference

### `not(predicate)`

Negates a predicate expression.

```typescript
function not(predicate: PredicateExpr): PredicateNotExpr
```

:::param
---
name: predicate
type: "PredicateExpr"
required: true
---
The predicate to negate. Accepts the result of `.match()` on a reference, or a
combinator expression built with [`and()`](./and), [`or()`](./or), [`xor()`](./xor),
or another `not()`.
:::

:::note
---
---
`not()` also accepts a bare condition (without a subject) for use inside
[`match()`](./match) branches. The `match()` subject is applied to the condition leaf.
:::

#### Returns

A `PredicateNotExpr` - a predicate you can use in `visibleWhen`, `when`, `validWhen`,
reachability, or as an operand in another combinator.

### `not()` vs `.not`

The standalone `not()` function and the `.not` property on references serve different
purposes:

- **`.not`** on a reference negates a single `.match()` test inline:
  `Answer('status').not.match(Condition.Equals('closed'))`.
  `.not.not` cancels itself out.
- **`not()`** as a function wraps any already-built predicate, including compound ones
  built with `and()`, `or()`, or `xor()`.

Use `.not` when you negate one condition on one reference. Use `not()` when you negate
a combined predicate.

---

## Usage

### Negate a stored predicate

Store a compound predicate in a variable, then negate it for a different context:

```typescript
const prerequisitesMet = and(
  Answer('yourDetailsStatus').match(Condition.Equals('completed')),
  Answer('visitPreferencesStatus').match(Condition.Equals('completed')),
)

// Show instructions only when prerequisites are NOT met
visibleWhen: not(prerequisitesMet)
```

### Write a "valid when empty or correct" rule

Combine `not()` with `or()` to accept an empty field or a valid value:

```typescript
validWhen: [
  validation({
    condition: or(
      not(Self().match(Condition.IsRequired())),
      Self().match(Condition.Address.IsValidPostcode()),
    ),
    message: 'Enter a valid postcode',
  }),
]
```

This validation passes when the field is empty or when the value is a valid postcode.

### Negate a compound condition

```typescript
visibleWhen: not(
  or(
    Answer('status').match(Condition.Equals('cancelled')),
    Answer('status').match(Condition.Equals('expired')),
  )
)
```

This is true when the status is neither `'cancelled'` nor `'expired'`.

---

## Troubleshooting

### not() called with multiple arguments

`not()` accepts exactly one predicate. To negate a group of conditions, wrap them in
`and()` or `or()` first:

```typescript
// This will not work
not(predicate1, predicate2)

// Negate the group
not(and(predicate1, predicate2))
```

### Choosing between not() and .not

Use `.not` on a reference when you negate a single condition inline. Use `not()` when
you negate a predicate that is already built, or when you negate a compound predicate.

```typescript
// .not for inline negation of one condition
Answer('status').not.match(Condition.Equals('closed'))

// not() for a compound predicate
not(and(
  Answer('a').match(Condition.Equals(true)),
  Answer('b').match(Condition.Equals(true)),
))
```
