---
title: Combinators
section: authoring-language
path: authoring-language/combinators
teaches: [and, or, not, xor, combinators, predicate-composition]
prerequisites: [condition, match-method]
---

<p class="govuk-caption-xl">Expressions</p>

# Combinators

Combinators compose multiple conditions into a single predicate.
`and`, `or`, `not`, and `xor` let you build complex boolean logic
from simple `.matches()` expressions.

{{slot:toc}}

---

## What are combinators?

A single `.matches()` tests one value against one condition. When a
decision depends on multiple conditions, combinators join them
together:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

Each combinator takes predicate expressions (the results of
`.matches()` calls) and returns a new predicate expression.

Inside a `match_()` branch they also accept bare conditions - see
[In match branches](#in-match-branches).

---

## The combinators

### `and(predicates)`

All predicates must be true.

```rust
and(vec![self_().matches(condition::date::is_valid()), self_().not().matches(condition::date::is_future_date())])
```

Useful for combining multiple validation requirements:

```rust
validation(obj! {
    "condition": and(vec![self_().matches(condition::string::has_min_length(2)), self_().matches(condition::string::has_max_length(50)), self_().matches(condition::string::letters_with_space_dash_apostrophe())]),
    "message": "Enter a valid name between 2 and 50 characters",
})
```

### `or(predicates)`

At least one predicate must be true.

```rust
or(vec![answer("email").matches(condition::is_required()), answer("phone").matches(condition::is_required()), answer("address").matches(condition::is_required())])
```

A common use is step-level validation that requires at least one of
several fields to be filled:

```rust
step(obj! {
    "path": "/contact",
    "title": "Contact details",
    "validWhen": [
        validation(obj! {
            "condition": or(vec![answer("email").matches(condition::is_required()), answer("phone").matches(condition::is_required())]),
            "message": "Provide at least one contact method",
        }),
    ],
})
```

### `not(predicate)`

Inverts a predicate. Returns `true` when the predicate is `false`.

```rust
not(answer("status").matches(condition::equals("closed")))
```

> You can also use `.not().matches()` directly on a reference, which
> reads more naturally for single conditions:
> `answer("status").not().matches(condition::equals("closed"))`.
> The `not()` combinator is more useful when you need to invert
> an `and` or `or` expression.

### `xor(predicates)`

Exactly one predicate must be true.

```rust
xor(vec![answer("useExistingAddress").matches(condition::equals(true)), answer("newAddress").matches(condition::is_required())])
```

---

## Using in your definitions

Combinators work anywhere a predicate is accepted: `validWhen`,
`visibleWhen`, `dependentWhen`, and `when` on hooks and outcomes.

### In validation

```rust
validation(obj! {
    "condition": or(vec![self_().matches(condition::date::is_today()), self_().matches(condition::date::is_future_date())]),
    "message": "Date must be today or in the future",
})
```

### In visibility

```rust
govuk::INSET_TEXT.build(obj! {
    "text": "Your case is read-only.",
    "visibleWhen": and(vec![data("case.isReadOnly").matches(condition::equals(true)), session("permissions.casework.edit").not().matches(condition::equals(true))]),
})
```

### In hooks

```rust
access(obj! {
    "when": or(vec![data("case").not().matches(condition::is_required()), data("case.isArchived").matches(condition::equals(true))]),
    "next": [redirect(obj! { "goto": "/not-found" })],
})
```

### In match branches

Inside `match_().branch()`, combinators take bare conditions
instead of predicates. There's no `.matches()` call because the
branch has no subject of its own - every condition in the tree is
tested against the match subject:

```rust
match_(session("deletionResponse").path("exception"))
    .branch(
        and(vec![condition::object::is_object(), condition::object::property_has_value("eventUuid")]),
        format("Could not aggregate %1", [session("deletionResponse").path("exception.eventName").into()]),
    )
    .branch(condition::object::is_object(), "Something went wrong")
    .otherwise("")
```

Nesting works the same as with predicates:

```rust
match_(answer("status"))
    .branch(
        or(vec![
            and(vec![condition::is_required(), condition::equals("OPEN")]),
            not(condition::is_required()),
        ]),
        "Actionable",
    )
    .otherwise("Closed")
```

You can't mix the two forms in one call - `and(vec![condition,
predicate])` is not valid. Conditions take their subject from
the surrounding match, so they only make sense inside a branch.

---

## API surface

All four combinators also accept bare conditions in place of
predicates when used inside `match_().branch()` - same call forms,
no mixing of the two.

### `and(predicates)`

All predicates must be true. Takes a `Vec` of predicates.

```rust
and(vec![pred1, pred2, pred3])
```

### `or(predicates)`

At least one predicate must be true. Takes a `Vec` of predicates.

```rust
or(vec![pred1, pred2, pred3])
```

### `not(predicate)`

Inverts a single predicate.

```rust
not(pred)
```

### `xor(predicates)`

Exactly one predicate must be true. Takes a `Vec` of predicates.

```rust
xor(vec![pred1, pred2])
xor(vec![pred1, pred2, pred3])
```

---

## Best practices

- **Prefer `.not().matches()` over `not()` for single conditions.**
  `answer("x").not().matches(condition::equals("y"))` reads more
  naturally than `not(answer("x").matches(condition::equals("y")))`.
- **Use `not()` when inverting composed predicates.** Wrapping an
  `and(vec![])` or `or(vec![])` in `not()` is cleaner than rewriting the logic.
- **Keep compositions shallow.** If you find yourself nesting
  `and(vec![or(...), and(...)])` deeply, consider whether the logic can
  be simplified or split across multiple validation rules.
