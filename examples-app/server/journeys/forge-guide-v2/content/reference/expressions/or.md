---
title: or()
slug: or
section: reference
path: reference/or
nav: Authoring API/Expressions
order: 45
description: Combines predicates so that at least one must be true
teaches: [or, expressions, logic, predicates, combinators]
prerequisites: [step]
related:
  reference: and, not, xor, answer
---

# `or()`

`or()` combines two or more predicates into one. The combined predicate is true when
at least one operand is true.

```typescript
import { or } from '@ministryofjustice/hmpps-forge/core/authoring'

// Either role is accepted
visibleWhen: or(
  Answer('role').match(Condition.Equals('admin')),
  Answer('role').match(Condition.Equals('superadmin')),
)

// Allow empty or valid
condition: or(
  not(Self().match(Condition.IsRequired())),
  Self().match(Condition.Address.IsValidPostcode()),
)
```

Use `or()` anywhere a predicate is accepted: `visibleWhen`, hook `when`, [`validWhen`](./validation),
and reachability expressions. The result can also be an operand in another combinator
like [`and()`](./and) or [`not()`](./not).

---

## Reference

### `or(...predicates)`

Combines predicates so that at least one must be true.

```typescript
function or(
  ...predicates: [PredicateExpr, PredicateExpr, ...PredicateExpr[]]
): PredicateOrExpr

function or(predicates: PredicateExpr[]): PredicateOrExpr
```

Accepts two or more predicates as separate arguments, or as a single array. Each
predicate is the result of `.match()` on a reference, or another combinator expression.

:::note
---
---
`or()` also accepts bare conditions (without a subject) for use inside
[`match()`](./match) branches. Do not mix predicates and bare conditions in the same
call - this throws a runtime error.
:::

#### Returns

A `PredicateOrExpr` - a predicate you can use in `visibleWhen`, `when`, `validWhen`,
reachability, or as an operand in another combinator.

---

## Usage

### Accept multiple valid values

```typescript
visibleWhen: or(
  Answer('country').match(Condition.Equals('UK')),
  Answer('country').match(Condition.Equals('IE')),
)
```

This is true when the country is either `'UK'` or `'IE'`.

### Allow empty or valid in a validation

A common pattern - let the field pass when it is empty, but validate the value when
one is present:

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

### Combine with and()

```typescript
visibleWhen: or(
  and(
    Answer('role').match(Condition.Equals('admin')),
    Answer('env').match(Condition.Equals('production')),
  ),
  Answer('overrideAccess').match(Condition.Equals(true)),
)
```

This is true when the user is an admin in production, or when the override flag is set.

### Use bare conditions inside a match() branch

Inside a [`match()`](./match) branch, conditions take their subject from the
surrounding `match()`. Pass bare [`Condition.*`](./condition) calls instead of full predicates:

```typescript
match(Answer('code'))
  .branch(
    or(Condition.Equals('A'), Condition.Equals('B')),
    'Group 1',
  )
  .otherwise('Group 2')
```

---

## Troubleshooting

### or() called with fewer than two predicates

`or()` requires at least two operands. A single predicate does not need wrapping -
use it directly.

### Mixing predicates and bare conditions

Predicates carry their own subject (for example,
`Answer('x').match(Condition.Equals('y'))`). Bare conditions do not (for example,
`Condition.Equals('y')` on its own). You cannot mix the two in one `or()` call.

Use predicates for standalone expressions like `visibleWhen`. Use bare conditions
inside [`match()`](./match) branches, where the subject comes from `match()`.
