---
title: Conditional()
slug: conditional
section: reference
path: reference/conditional
nav: Authoring API/Expressions
order: 43
description: Creates a conditional value expression with object syntax
teaches: [conditional, expressions, if-else, value-selection]
prerequisites: [step]
related:
  reference: when, match, answer
---

# `Conditional()`

`Conditional()` creates a conditional value expression using object syntax. You pass an
options object with `when`, `then`, and optionally `else`.

```typescript
import { Conditional } from '@ministryofjustice/hmpps-forge/core/authoring'

// Choose a label based on a condition
Conditional({
  when: Answer('country').match(Condition.Equals('UK')),
  then: 'Postcode',
  else: 'ZIP code',
})

// Fall back to a default value
Conditional({
  when: Answer('nickname').match(Condition.IsRequired()),
  then: Answer('nickname'),
  else: Answer('firstName'),
})
```

`Conditional()` is the object-syntax form of [`when()`](./when). Both produce the same
compiled expression. Use whichever reads more clearly - `Conditional()` for simple
cases, [`when()`](./when) for nested chains.

---

## Reference

### `Conditional(options)`

Creates a conditional value expression from an options object.

```typescript
function Conditional(options: {
  when: PredicateExpr,
  then: BranchValue,
  else?: BranchValue,
}): ChainableConditional
```

:::param
---
name: options.when
type: "PredicateExpr"
required: true
---
The condition to evaluate. This is what `.match()` on a reference produces - for
example, `Answer('status').match(Condition.Equals('active'))`. Combinator expressions
built with [`and()`](./and), [`or()`](./or), [`not()`](./not), and [`xor()`](./xor)
are also accepted.
:::

:::param
---
name: options.then
type: "BranchValue"
required: true
---
The value to use when the predicate is true. Accepts strings, numbers, booleans,
references like `Answer('name')`, or nested expressions.
:::

:::param
---
name: options.else
type: "BranchValue"
required: false
---
The value to use when the predicate is false. Same types as `then`. Defaults to `false`
when omitted.
:::

#### Returns

A `ChainableConditional` - the same builder that [`when()`](./when) returns. You can
continue the chain with `.then()` or `.else()` to override the values set in the
options object.

---

## Usage

### Choose between two values

```typescript
GovUKTextInput({
  code: 'postalCode',
  label: Conditional({
    when: Answer('country').match(Condition.Equals('UK')),
    then: 'What is your postcode?',
    else: 'What is your ZIP code?',
  }),
})
```

### Provide a fallback value

```typescript
GovUKHeading({
  text: Conditional({
    when: Answer('nickname').match(Condition.IsRequired()),
    then: Answer('nickname'),
    else: Answer('firstName'),
  }),
})
```

The expression resolves to the nickname when one exists, and falls back to the
first name.

### Nest conditionals

A `Conditional()` can appear in the `then` or `else` position of another:

```typescript
Conditional({
  when: Answer('tier').match(Condition.Equals('premium')),
  then: 'Premium',
  else: Conditional({
    when: Answer('tier').match(Condition.Equals('standard')),
    then: 'Standard',
    else: 'Basic',
  }),
})
```

For three or more branches, [`match()`](./match) produces the same result with a
flatter structure.

### Use a compound predicate

Combine multiple conditions with [`and()`](./and) or [`or()`](./or):

```typescript
Conditional({
  when: and(
    Answer('role').match(Condition.Equals('admin')),
    Answer('env').match(Condition.Equals('production')),
  ),
  then: 'Full access',
  else: 'Read only',
})
```

---

## Troubleshooting

### else defaults to false, not undefined

When you omit `else`, the false branch resolves to `false`, not `undefined`. If you
need an absent value when the condition is false, pass `null`:

```typescript
Conditional({
  when: Answer('showBanner').match(Condition.Equals(true)),
  then: 'Welcome back!',
  else: null,
})
```

### Conditional() used where a predicate is expected

`Conditional()` produces a value expression, not a predicate. You cannot pass it to
`visibleWhen`, `validWhen`, or hook `when` properties. Those properties expect a
predicate - the result of `.match()` on a reference, or a combinator like `and()`.
