---
title: Conditionals
section: authoring-language
path: authoring-language/conditionals
teaches: [when, Conditional, match-expression, match-branch, conditional-values]
prerequisites: [condition, match-method, answer, data]
---

<p class="govuk-caption-xl">Expressions</p>

# Conditionals

Conditionals produce different values based on conditions. Where
`.matches()` produces a boolean and combinators compose booleans,
conditionals branch on a boolean to return one value or another.
They are how you make block properties, labels, text, and other
values vary based on user input.

{{slot:toc}}

---

## What is a conditional?

A conditional expression evaluates a condition and returns one of
two or more possible values. Forge provides three forms, each
suited to different situations:

- **`when().then().otherwise()`** - fluent if/then/else for two branches
- **`when()`** - object syntax for the same thing
- **`match_().branch().otherwise()`** - multi-branch, like a switch

All three resolve to a concrete value at evaluation time. Forge
evaluates the conditions, picks the matching branch, and the result
is what the block or property receives.

---

## when().then().otherwise()

The fluent form reads naturally for simple two-way branches:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

when(answer("age").matches(condition::number::greater_than(18))).then("Adult").otherwise("Under 18")
```

The condition is any predicate expression. `.then()` is the value
when true, `.otherwise()` is the value when false. Both branches can be
any value: strings, numbers, expressions, even other conditionals.

### Nested conditionals

Because `.then()` and `.otherwise()` accept any value, you can nest
`when()` calls for multi-level logic:

```rust
when(answer("hasTravelled").matches(condition::equals("yes"))).then(when(answer("trips").pipe([transformer::array::length()]).matches(condition::number::greater_than(5))).then("Frequent traveller").otherwise("Occasional traveller")).otherwise("Has not travelled")
```

For more than two or three branches, `match_()` is usually clearer.

### Common uses

Dynamic labels:

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "postcode",
    "label": obj! {
        "text": when(answer("country").matches(condition::equals("UK"))).then("Postcode").otherwise("ZIP or postal code"),
    },
})
```

Dynamic hint text:

```rust
"hint": obj! {
    "text": when(answer("country").matches(condition::equals("UK"))).then("For example, SW1A 1AA").otherwise("For example, 90210"),
},
```

---

## Conditional()

The object syntax does the same thing as `when().then().otherwise()` but
in a different shape:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

CONDITIONAL.build(obj! {
    "when": answer("country").matches(condition::equals("UK")),
    "then": "Postcode",
    "else": "ZIP or postal code",
})
```

This form can be useful when the conditional is part of a larger
object structure and the fluent chaining would break the visual
flow.

---

## match().branch().otherwise()

For values that depend on multiple possible states, `match_()` reads
like a switch statement:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

match_(answer("appointmentType")).branch(condition::equals("in-person"), "In-person appointment").branch(condition::equals("phone"), "Phone appointment").branch(condition::equals("video"), "Video call appointment").otherwise("Appointment")
```

`match_()` takes a reference as its subject. Each `.branch()` tests
the subject against a condition and returns the paired value if it
matches. `.otherwise()` provides a fallback when no branch matches.

Branches are evaluated in order. The first matching branch wins.

### Combining conditions in a branch

A branch can test more than one thing at once by wrapping
conditions in the [combinators](../combinators/combinators)
`and`, `or`, `xor`, and `not`. Unlike elsewhere, there's no
`.matches()` call - every condition is tested against the match
subject:

```rust
match_(session("deletionResponse").path("exception")).branch(and(vec![condition::object::is_object(), condition::object::property_has_value("eventUuid")]), format("Could not aggregate %1", [session("deletionResponse").path("exception.eventName").into()])).branch(condition::object::is_object(), "Something went wrong").otherwise("")
```

Combinators nest to any depth, so `or(vec![and(vec![a, b]), not(c)])` works as
a branch condition too.

### In block properties

`match_()` is commonly used for display values that vary based on
an answer:

```rust
govuk::SUMMARY_LIST.build(obj! {
    "rows": [
        obj! {
            "key": obj! { "text": "Contact method" },
            "value": obj! {
                "text": match_(answer("contactMethod")).branch(condition::equals("email"), format("Email (%1)", [answer("email").into()])).branch(condition::equals("phone"), format("Phone (%1)", [answer("phoneNumber").into()])).branch(condition::equals("text"), format("Text message (%1)", [answer("mobileNumber").into()])).otherwise(""),
            },
        },
    ],
})
```

### As Format arguments

`match_()` works as an argument to `format()`, letting you vary
part of a string:

```rust
govuk::PANEL.build(obj! {
    "titleText": "Appointment booked",
    "html": format("Your %1 appointment has been booked.", [match_(answer("appointmentType")).branch(condition::equals("in-person"), "in-person").branch(condition::equals("phone"), "phone").branch(condition::equals("video"), "video call").otherwise("").build()]),
})
```

### Inside iterators

`match_()` can branch on item properties within an `.each()`:

```rust
match_(item().path("status")).branch(condition::equals("ACTIVE"), "Active").branch(condition::equals("CLOSED"), "Closed").otherwise("Unknown")
```

---

## API surface

### `when(predicate)`

Creates a fluent conditional. Returns a builder with `.then(value)`
and `.otherwise(value)` methods.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

### `when(predicate).then(a).otherwise(b)`

Creates a conditional from an object. `when` is a predicate, `then`
and `else` are the branch values.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

### `match_(subject)`

Creates a multi-branch conditional. Returns a builder with
`.branch(condition, value)` and `.otherwise(value)` methods. The
condition can be a single condition or a combinator tree of them.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

Branches are evaluated in order. The first match wins.

---

## Best practices

- **Use `when()` for two branches, `match_()` for three or more.**
  A single if/else is clearer with `when()`. Multiple branches are
  clearer with `match_()`.
- **Always provide a fallback.** Use `.otherwise()` on `when()` and
  `.otherwise()` on `match_()` to handle unexpected values. Without
  them, `when()` falls back to `false` and `match_()` to `undefined`.
- **Avoid deeply nested `when()` calls.** If you find yourself
  nesting more than two levels, `match_()` or restructuring the data
  in an effect is usually clearer.
- **Use `when()` when fluent chaining breaks readability.**
  Inside deeply nested object literals, the object form can be
  easier to follow than the fluent form.
