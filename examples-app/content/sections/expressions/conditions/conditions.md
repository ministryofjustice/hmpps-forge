---
title: Conditions
section: authoring-language
path: authoring-language/conditions
teaches: [condition, match-method, predicate]
prerequisites: [answer, self_, data, validation, visibleWhen, dependentWhen]
---

<p class="govuk-caption-xl">Functions</p>

# Conditions

Conditions are predicate functions that test a value and return
true or false. They are how Forge makes decisions: whether a field
is valid, whether a block is visible, whether a redirect should
fire. Forge ships with conditions for common checks, and you can
define your own.

{{slot:toc}}

---

## What is a condition?

A condition is a function that receives a value and returns a
boolean. It answers a question about the value: is it present? Is
it a valid email? Is it greater than 18? Conditions are always used
through `.matches()` on a reference, which pairs the value with the
test.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

answer("email").matches(condition::is_required())
answer("age").matches(condition::number::greater_than(18))
self_().matches(condition::string::has_max_length(200))
```

Conditions describe when something **is** valid, not when it is
invalid. The result of `.matches()` is a predicate expression that
evaluates to `true` when the condition passes. To express the
opposite, use `.not().matches()`:

```rust
answer("date").not().matches(condition::date::is_future_date())
```

### Where conditions are used

Conditions appear anywhere Forge needs a boolean decision:

- **`validWhen`** on fields and steps, to define validation rules
- **`visibleWhen`** on blocks, to control rendering
- **`dependentWhen`** on fields, to control validation and value
  retention
- **`when`** on hooks, redirects, and error outcomes, to control
  execution

The condition itself does not know which context it is used in. It
just tests a value. The context determines what happens with the
result.

---

## How it works

When Forge evaluates `answer("email").matches(condition::is_required())`,
two things happen:

1. The reference is resolved to a concrete value
2. The condition function receives that value and returns `true` or
   `false`

Condition arguments can be static values or expressions. A static
argument like `condition::number::greater_than(18)` bakes the value
in. A dynamic argument like
`condition::equals(answer("otherField"))` resolves the argument at
evaluation time, so the comparison value can change between
requests.

```rust
// Static: always compared against 18
answer("age").matches(condition::number::greater_than(18))
// Dynamic: compared against whatever the user entered for minAge
answer("age").matches(condition::number::greater_than(answer("minAge")))
```

---

## Using in your definitions

### Validation

The most common use. Each rule pairs a condition with an error
message:

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "fullName",
    "label": obj! { "text": "Full name" },
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter your full name",
        }),
        validation(obj! {
            "condition": self_().matches(condition::string::has_max_length(200)),
            "message": "Full name must be 200 characters or less",
        }),
        validation(obj! {
            "condition": self_().matches(condition::string::letters_with_space_dash_apostrophe()),
            "message": "Full name must only include letters, spaces, hyphens and apostrophes",
        }),
    ],
})
```

### Conditional visibility

Show or hide blocks based on a condition:

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "phoneNumber",
    "label": obj! { "text": "Phone number" },
    "visibleWhen": answer("contactMethod").matches(condition::equals("phone")),
    "dependentWhen": answer("contactMethod").matches(condition::equals("phone")),
})
```

### Hook guards

Control which hooks run:

```rust
access(obj! {
    "when": params("areaOfNeed").not().matches(condition::array::is_in(data("validAreas"))),
    "next": [redirect(obj! { "goto": "/not-found" })],
})
```

### Composing conditions

Conditions can be combined with `and`, `or`, `not`, and `xor`:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

// Both must be true
and(vec![self_().matches(condition::date::is_valid()), self_().not().matches(condition::date::is_future_date())])
// At least one must be true
or(vec![answer("email").matches(condition::is_required()), answer("phone").matches(condition::is_required())])
// Invert a condition
not(answer("status").matches(condition::equals("closed")))
```

These combinators are covered in more detail on the
[Matching and combinators](combinators) page.

---

## Custom conditions

When you need domain-specific validation or visibility logic that
the built-in set does not cover, you can define your own
conditions. They are used through `.matches()` on references in
exactly the same way as built-ins.

See [Building custom conditions](../building-functions-and-components/custom-conditions)
for the shape interface, implementation, type-checking conventions,
and registration details.

---

## API surface

### `.matches(condition)`

Tests a reference's resolved value against a condition. Returns a
predicate expression.

```rust
answer("email").matches(condition::is_required())
```

### `.not().matches(condition)`

Negates the condition. Returns `true` when the condition fails.

```rust
answer("date").not().matches(condition::date::is_future_date())
```

---

## Best practices

- **Write conditions in positive form.** Describe when the field
  *is* valid, not when it is invalid. Use `.not().matches()` only when
  there is no positive-form condition available.
- **Use dynamic arguments for cross-field comparisons.**
  `condition::equals(answer("otherField"))` resolves the argument at
  evaluation time, keeping the condition reactive.

---

## Built-in conditions

For the full reference of every built-in condition with detailed
descriptions and examples, see the Forge Core package pages:

- [General conditions](/forge-developer-guide/packages/forge-core/conditions-general) - `IsRequired`, `Equals`
- [String conditions](/forge-developer-guide/packages/forge-core/conditions-string) - length, pattern matching, character sets
- [Number conditions](/forge-developer-guide/packages/forge-core/conditions-number) - comparisons, ranges, type checks
- [Date conditions](/forge-developer-guide/packages/forge-core/conditions-date) - validity, comparisons, past/future
- [Array conditions](/forge-developer-guide/packages/forge-core/conditions-array) - membership, containment
- [Object conditions](/forge-developer-guide/packages/forge-core/conditions-object) - structure, property checks
- [Email conditions](/forge-developer-guide/packages/forge-core/conditions-email) - format validation
- [Phone conditions](/forge-developer-guide/packages/forge-core/conditions-phone) - UK and international
- [Address conditions](/forge-developer-guide/packages/forge-core/conditions-address) - postcode validation
