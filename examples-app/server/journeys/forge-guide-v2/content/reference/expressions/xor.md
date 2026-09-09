---
title: xor()
slug: xor
section: reference
path: reference/xor
nav: Authoring API/Expressions
order: 46
description: Combines predicates so that exactly one must be true
teaches: [xor, expressions, logic, predicates, combinators]
prerequisites: [step]
related:
  reference: and, or, not, answer
---

# `xor()`

`xor()` combines two or more predicates into one. The combined predicate is true only
when exactly one operand is true.

```typescript
import { xor } from '@ministryofjustice/hmpps-forge/core/authoring'

// Exactly one contact method must be selected
validWhen: [
  validation({
    condition: xor(
      Answer('contactByEmail').match(Condition.Equals(true)),
      Answer('contactByPhone').match(Condition.Equals(true)),
    ),
    message: 'Choose email or phone, not both',
  }),
]
```

Use `xor()` anywhere a predicate is accepted: `visibleWhen`, hook `when`, [`validWhen`](./validation),
and reachability expressions. The result can also be an operand in another combinator
like [`and()`](./and) or [`not()`](./not).

---

## Reference

### `xor(...predicates)`

Combines predicates so that exactly one must be true.

```typescript
function xor(
  ...predicates: [PredicateExpr, PredicateExpr, ...PredicateExpr[]]
): PredicateXorExpr

function xor(predicates: PredicateExpr[]): PredicateXorExpr
```

Accepts two or more predicates as separate arguments, or as a single array. Each
predicate is the result of `.match()` on a reference, or another combinator expression.

With three or more operands, `xor()` is true when exactly one of all operands is true.
This is not a pairwise check - it counts how many are true across the whole set.

:::note
---
---
`xor()` also accepts bare conditions (without a subject) for use inside
[`match()`](./match) branches. Do not mix predicates and bare conditions in the same
call - this throws a runtime error.
:::

#### Returns

A `PredicateXorExpr` - a predicate you can use in `visibleWhen`, `when`, `validWhen`,
reachability, or as an operand in another combinator.

---

## Usage

### Validate that exactly one option is chosen

```typescript
validWhen: [
  validation({
    condition: xor(
      Answer('contactByEmail').match(Condition.Equals(true)),
      Answer('contactByPhone').match(Condition.Equals(true)),
    ),
    message: 'Choose email or phone, not both',
  }),
]
```

This fails when both are selected, and also when neither is selected.

### Use with three or more operands

```typescript
condition: xor(
  Answer('methodA').match(Condition.Equals(true)),
  Answer('methodB').match(Condition.Equals(true)),
  Answer('methodC').match(Condition.Equals(true)),
)
```

This is true when exactly one of the three is true. If two or all three are true, the
result is false.

### Use bare conditions inside a match() branch

Inside a [`match()`](./match) branch, conditions take their subject from the
surrounding `match()`. Pass bare [`Condition.*`](./condition) calls instead of full predicates:

```typescript
match(Answer('value'))
  .branch(
    xor(
      Condition.Number.GreaterThan(10),
      Condition.Number.LessThan(5),
    ),
    'In one range only',
  )
  .otherwise('In both or neither range')
```

---

## Troubleshooting

### xor() called with fewer than two predicates

`xor()` requires at least two operands. A single predicate does not need wrapping -
use it directly.

### xor() with three operands behaves differently than expected

With three operands, `xor()` is true when exactly one is true. It does not chain
pairwise like a bitwise XOR. If you need "at least one but not all", combine
[`or()`](./or) with [`not()`](./not) and [`and()`](./and) instead.

### Mixing predicates and bare conditions

Predicates carry their own subject (for example,
`Answer('x').match(Condition.Equals('y'))`). Bare conditions do not (for example,
`Condition.Equals('y')` on its own). You cannot mix the two in one `xor()` call.

Use predicates for standalone expressions like `visibleWhen`. Use bare conditions
inside [`match()`](./match) branches, where the subject comes from `match()`.
