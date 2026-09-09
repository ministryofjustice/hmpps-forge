---
title: and()
slug: and
section: reference
path: reference/and
nav: Authoring API/Expressions
order: 44
description: Combines predicates so that all must be true
teaches: [and, expressions, logic, predicates, combinators]
prerequisites: [step]
related:
  reference: or, not, xor, answer
---

# `and()`

`and()` combines two or more predicates into one. The combined predicate is true only
when every operand is true.

```typescript
import { and } from '@ministryofjustice/hmpps-forge/core/authoring'

// Both conditions must be true
visibleWhen: and(
  Answer('age').match(Condition.Number.GreaterThan(18)),
  Answer('consent').match(Condition.Equals(true)),
)

// Three conditions as a reachability guard
reachability: {
  entryWhen: and(
    Answer('step1Status').match(Condition.Equals('completed')),
    Answer('step2Status').match(Condition.Equals('completed')),
    Answer('step3Status').match(Condition.Equals('completed')),
  ),
}
```

Use `and()` anywhere a predicate is accepted: `visibleWhen`, hook `when`, [`validWhen`](./validation),
and reachability expressions. The result can also be an operand in another combinator
like [`or()`](./or) or [`not()`](./not).

---

## Reference

### `and(...predicates)`

Combines predicates so that all must be true.

```typescript
function and(
  ...predicates: [PredicateExpr, PredicateExpr, ...PredicateExpr[]]
): PredicateAndExpr

function and(predicates: PredicateExpr[]): PredicateAndExpr
```

Accepts two or more predicates as separate arguments, or as a single array. Each
predicate is the result of `.match()` on a reference, or another combinator expression.

:::note
---
---
`and()` also accepts bare conditions (without a subject) for use inside
[`match()`](./match) branches. Do not mix predicates and bare conditions in the same
call - this throws a runtime error.
:::

#### Returns

A `PredicateAndExpr` - a predicate you can use in `visibleWhen`, `when`, `validWhen`,
reachability, or as an operand in another combinator.

---

## Usage

### Require multiple conditions

Store the combined predicate in a variable and reuse it:

```typescript
const prerequisitesMet = and(
  Answer('yourDetailsStatus').match(Condition.Equals('completed')),
  Answer('visitPreferencesStatus').match(Condition.Equals('completed')),
)

reachability: { entryWhen: prerequisitesMet }
```

### Combine with other combinators

`and()` nests freely with [`or()`](./or), [`not()`](./not), and [`xor()`](./xor):

```typescript
visibleWhen: and(
  Answer('role').match(Condition.Equals('admin')),
  or(
    Answer('env').match(Condition.Equals('staging')),
    Answer('env').match(Condition.Equals('development')),
  ),
)
```

This is true when the role is `'admin'` and the environment is either `'staging'` or
`'development'`.

### Use bare conditions inside a match() branch

Inside a [`match()`](./match) branch, conditions take their subject from the
surrounding `match()`. Pass bare [`Condition.*`](./condition) calls instead of full predicates:

```typescript
match(Answer('referenceCode'))
  .branch(
    and(
      Condition.String.StartsWith('FT'),
      Condition.String.Contains('2024'),
    ),
    'Fast track 2024',
  )
  .otherwise('Other')
```

### Pass an array of predicates

When the predicates come from a computed list, pass them as an array:

```typescript
const checks = fields.map(f =>
  Answer(f.code).match(Condition.IsRequired())
)

when: and(checks)
```

---

## Troubleshooting

### and() called with fewer than two predicates

`and()` requires at least two operands. A single predicate does not need wrapping -
use it directly.

### Mixing predicates and bare conditions

Predicates carry their own subject (for example,
`Answer('x').match(Condition.Equals('y'))`). Bare conditions do not (for example,
`Condition.Equals('y')` on its own). You cannot mix the two in one `and()` call.

Use predicates for standalone expressions like `visibleWhen`. Use bare conditions
inside [`match()`](./match) branches, where the subject comes from `match()`.
