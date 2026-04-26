---
title: Combinators
section: authoring-language
path: authoring-language/combinators
teaches: [and, or, not, xor, combinators, predicate-composition]
prerequisites: [Condition, match-method]
---

<p class="govuk-caption-xl">Expressions</p>

# Combinators

Combinators compose multiple conditions into a single predicate.
`and`, `or`, `not`, and `xor` let you build complex boolean logic
from simple `.match()` expressions.

{{slot:toc}}

---

## What are combinators?

A single `.match()` tests one value against one condition. When a
decision depends on multiple conditions, combinators join them
together:

```typescript
import { and, or, not, xor } from '@ministryofjustice/hmpps-forge/core/authoring'
```

Each combinator takes predicate expressions (the results of
`.match()` calls) and returns a new predicate expression.

---

## The combinators

### `and(...predicates)`

All predicates must be true.

```typescript
and(
  Self().match(Condition.Date.IsValid()),
  Self().not.match(Condition.Date.IsFutureDate()),
)
```

Useful for combining multiple validation requirements:

```typescript
validation({
  condition: and(
    Self().match(Condition.String.HasMinLength(2)),
    Self().match(Condition.String.HasMaxLength(50)),
    Self().match(Condition.String.LettersWithSpaceDashApostrophe()),
  ),
  message: 'Enter a valid name between 2 and 50 characters',
})
```

### `or(...predicates)`

At least one predicate must be true.

```typescript
or(
  Answer('email').match(Condition.IsRequired()),
  Answer('phone').match(Condition.IsRequired()),
  Answer('address').match(Condition.IsRequired()),
)
```

A common use is step-level validation that requires at least one of
several fields to be filled:

```typescript
step({
  path: '/contact',
  title: 'Contact details',
  validWhen: [
    validation({
      condition: or(
        Answer('email').match(Condition.IsRequired()),
        Answer('phone').match(Condition.IsRequired()),
      ),
      message: 'Provide at least one contact method',
    }),
  ],
})
```

### `not(predicate)`

Inverts a predicate. Returns `true` when the predicate is `false`.

```typescript
not(Answer('status').match(Condition.Equals('closed')))
```

> You can also use `.not.match()` directly on a reference, which
> reads more naturally for single conditions:
> `Answer('status').not.match(Condition.Equals('closed'))`.
> The `not()` combinator is more useful when you need to invert
> an `and` or `or` expression.

### `xor(...predicates)`

Exactly one predicate must be true.

```typescript
xor(
  Answer('useExistingAddress').match(Condition.Equals(true)),
  Answer('newAddress').match(Condition.IsRequired()),
)
```

---

## Using in your definitions

Combinators work anywhere a predicate is accepted: `validWhen`,
`visibleWhen`, `dependentWhen`, and `when` on hooks and outcomes.

### In validation

```typescript
validation({
  condition: or(
    Self().match(Condition.Date.IsToday()),
    Self().match(Condition.Date.IsFutureDate()),
  ),
  message: 'Date must be today or in the future',
})
```

### In visibility

```typescript
GovUKInsetText({
  text: 'Your case is read-only.',
  visibleWhen: and(
    Data('case.isReadOnly').match(Condition.Equals(true)),
    Session('permissions.casework.edit').not.match(Condition.Equals(true)),
  ),
})
```

### In hooks

```typescript
access({
  when: or(
    Data('case').not.match(Condition.IsRequired()),
    Data('case.isArchived').match(Condition.Equals(true)),
  ),
  next: [redirect({ goto: '/not-found' })],
})
```

---

## API surface

### `and(...predicates)`

All predicates must be true. Accepts individual arguments or an
array.

```typescript
and(pred1, pred2, pred3)
and([pred1, pred2, pred3])
```

### `or(...predicates)`

At least one predicate must be true. Accepts individual arguments
or an array.

```typescript
or(pred1, pred2, pred3)
or([pred1, pred2, pred3])
```

### `not(predicate)`

Inverts a single predicate.

```typescript
not(pred)
```

### `xor(...predicates)`

Exactly one predicate must be true. Accepts individual arguments
or an array.

```typescript
xor(pred1, pred2)
xor([pred1, pred2, pred3])
```

---

## Best practices

- **Prefer `.not.match()` over `not()` for single conditions.**
  `Answer('x').not.match(Condition.Equals('y'))` reads more
  naturally than `not(Answer('x').match(Condition.Equals('y')))`.
- **Use `not()` when inverting composed predicates.** Wrapping an
  `and()` or `or()` in `not()` is cleaner than rewriting the logic.
- **Keep compositions shallow.** If you find yourself nesting
  `and(or(...), and(...))` deeply, consider whether the logic can
  be simplified or split across multiple validation rules.
