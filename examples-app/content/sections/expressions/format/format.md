---
title: Format
section: authoring-language
path: authoring-language/format
teaches: [format, string-interpolation, placeholders]
prerequisites: [answer, data, item]
---

<p class="govuk-caption-xl">Expressions</p>

# Format

`format()` builds strings from a template and a set of dynamic
values. It's how you compose text that includes references,
conditional content, or computed values without resorting to raw
string concatenation.

{{slot:toc}}

---

## What is Format?

`format()` takes a template string with numbered placeholders and
replaces each one with the corresponding argument. Placeholders use
`%1`, `%2`, `%3` and so on, starting from 1.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

format("Hello, %1!", [answer("fullName").into()])
```

If `answer("fullName")` resolves to `"Alice"`, the result is
`"Hello, Alice!"`.

Arguments can be any expression: references like `answer()` and
`data()`, conditional expressions like `match_()` and
`when().then().otherwise()`, piped transformations, or static strings.
They are all resolved before being substituted into the template.

---

## How it works

Forge evaluates each argument to a concrete value, then substitutes
them into the template by position. `%1` is replaced by the first
argument, `%2` by the second, and so on.

---

## Using in your definitions

### Display text

The simplest use is inserting an answer into a sentence:

```rust
govuk::BODY.build(obj! {
    "text": format("We have sent a confirmation email to %1.", [answer("email").into()]),
})
```

### Multiple placeholders

A single `format()` can combine several values:

```rust
govuk::PANEL.build(obj! {
    "titleText": "Appointment booked",
    "html": format("Your %1 appointment has been booked for %2 at %3.", [answer("appointmentType").into(), answer("appointmentDate").pipe([transformer::string::to_date(), transformer::date::format("D MMMM YYYY")]).into(), answer("appointmentTime").into()]),
})
```

### Conditional arguments

Arguments can themselves be conditional expressions. A `match_()`
inside a `format()` lets you vary part of the string based on an
answer:

```rust
format("Email (%1)", [answer("email").into()])
format("Contact: %1", [match_(answer("contactMethod")).branch(condition::equals("email"), answer("email")).branch(condition::equals("phone"), answer("phoneNumber")).otherwise("").build()])
```

### Dynamic URLs and field codes

`format()` is commonly used to build URLs for links and redirects:

```rust
redirect(obj! {
    "goto": format("../%1/add-steps", [data("goalUuid").into()]),
})
```

And to generate dynamic field codes inside iterators:

```rust
govuk::SELECT_INPUT.build(obj! {
    "code": format("step_actor_%1", [Loop.index0().into()]),
    "defaultValue": item().path("actor"),
})
```

---

## API surface

### `format(template, args)`

Builds a string by substituting arguments into a template.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

`template` is a string containing `%1`, `%2`, etc. placeholders.
Each `arg` is an expression or static value that replaces the
corresponding placeholder.

Returns a value expression (not a chainable reference).

---

## Best practices

- **Keep templates readable.** If a template has more than three or
  four placeholders, consider whether the string should be built
  differently or whether the data should be reshaped in an effect.
- **Use `format()` for URLs and field codes, not just display text.**
  Dynamic redirect paths and iterator-generated field codes are
  common uses that are easy to overlook.
- **Prefer `format()` over HTML string building.** When you need
  dynamic content inside HTML, `format()` with placeholders is
  clearer than concatenating strings with expression results.
