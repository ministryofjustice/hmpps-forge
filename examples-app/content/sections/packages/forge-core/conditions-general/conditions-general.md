---
title: General
section: packages
path: packages/forge-core/conditions-general
teaches: [condition::is_required, condition::equals, general-conditions]
prerequisites: [forge-core, conditions]
---

<p class="govuk-caption-xl">Forge Core</p>

# General conditions
General conditions are the most commonly used predicates in Forge.
They check whether a value is present and whether it equals an
expected value. Unlike the other condition groups, they sit directly
on the `Condition` namespace rather than under a sub-group.

{{slot:toc}}

---

## Conditions

### IsRequired

Returns true if the value is considered "present". Returns false
for null, undefined, empty strings (after trimming), and empty
arrays.

```rust
self_().matches(condition::is_required())
```

This is the standard "field must not be blank" validation:

```rust
validation(obj! {
    "condition": self_().matches(condition::is_required()),
    "message": "Enter your name",
})
```

It also works for checkbox arrays (empty array = nothing selected):

```rust
validation(obj! {
    "condition": self_().matches(condition::is_required()),
    "message": "Select at least one option",
})
```

### Equals

Returns true if the value is strictly equal (`===`) to the expected
value. The argument can be a static value or an expression.

```rust
answer("contactMethod").matches(condition::equals("email"))
answer("country").matches(condition::equals(data("defaultCountry")))
```

Common uses include branching on a radio selection:

```rust
redirect(obj! {
    "when": answer("contactMethod").matches(condition::equals("email")),
    "goto": "email-address",
})
redirect(obj! {
    "when": answer("contactMethod").matches(condition::equals("phone")),
    "goto": "phone-number",
})
```

And conditional visibility:

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "otherReason",
    "label": obj! { "text": "Please specify" },
    "visibleWhen": answer("reason").matches(condition::equals("other")),
})
```

---

## Practical examples

### Required field with a max length

```rust
"validWhen": [
    validation(obj! {
        "condition": self_().matches(condition::is_required()),
        "message": "Enter a description",
    }),
    validation(obj! {
        "condition": self_().matches(condition::string::has_max_length(200)),
        "message": "Description must be 200 characters or less",
    }),
],
```

