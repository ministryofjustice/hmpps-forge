---
title: Objects
section: packages
path: packages/forge-core/transformers-object
teaches: [transformer::object, object-transformers, ToISO, FromISO]
prerequisites: [forge-core, transformers]
---

<p class="govuk-caption-xl">Forge Core</p>

# Object transformers
Object transformers convert between objects and other
representations. They are currently focused on date-part objects -
the shape produced by multi-field date inputs where year, month,
and day arrive as separate properties.

{{slot:toc}}

---

## How to use them

Object transformers are called as `transformer::object::<name>()` and
applied with `.pipe()`:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

answer("dateOfBirth").pipe([transformer::object::to_iso(obj! { "year": "year", "month": "month", "day": "day" })])
```

---

## Date conversion

### ToISO

Converts an object with date-part properties into an ISO 8601 date
string. This is the transformer that turns a GOV.UK Date Input
submission of `{ year: "2024", month: "3", day: "15" }` into
`"2024-03-15"` - the date input wrappers add it for you as a
formatter.

The `paths` argument maps date components to property names (or
dot-separated paths for nested objects).

**Full date (year, month, day):**

```rust
answer("dob").pipe([transformer::object::to_iso(obj! { "year": "year", "month": "month", "day": "day" })])
// { year: "2024", month: "3", day: "15" } -> "2024-03-15"
```

**Partial date (year and month only):**

```rust
answer("startMonth").pipe([transformer::object::to_iso(obj! { "year": "year", "month": "month" })])
// { year: "2024", month: "3" } -> "2024-03"
```

**Nested paths:**

```rust
answer("record").pipe([transformer::object::to_iso(obj! { "year": "date.y", "month": "date.m", "day": "date.d" })])
// { date: { y: "2024", m: "3", d: "15" } } -> "2024-03-15"
```

Values are zero-padded automatically. When all three paths are
specified, all three values must be present or the transformer
throws (allowing field-level validation to catch the missing parts).

### FromISO

The inverse of `ToISO`. Converts an ISO 8601 date string back into
an object with date-part properties. If the input is already an
object, it is returned unchanged.

This is useful as a `parser` on date input fields so that a stored
ISO string is split back into the individual fields for display.

```rust
answer("dob").pipe([transformer::object::from_iso(obj! { "year": "year", "month": "month", "day": "day" })])
// "2024-03-15" -> { year: "2024", month: "03", day: "15" }
```

**Year-month only:**

```rust
answer("startMonth").pipe([transformer::object::from_iso(obj! { "year": "year", "month": "month" })])
// "2024-03" -> { year: "2024", month: "03" }
```

If the string does not match the expected format for the requested
paths, an empty object is returned.

---

## Practical examples

### Date input with ISO storage

A GOV.UK Date Input collects three separate fields. The wrapper
functions (`govuk::DATE_INPUT_FULL`, `govuk::DATE_INPUT_YEAR_MONTH`,
`govuk::DATE_INPUT_MONTH_DAY`) automatically add `ToISO` as a formatter
to store a single ISO string, and `FromISO` as a parser to split it
back for display - you don't need to add them yourself:

```rust
govuk::DATE_INPUT_FULL.build(obj! {
    "code": "dateOfBirth",
    "fieldset": obj! {
        "legend": obj! {
            "text": "Date of birth",
            "isPageHeading": true,
            "classes": "govuk-fieldset__legend--l",
        },
    },
})
```

Any `formatters` or `parsers` you pass in run after the built-in
ISO conversion.

### Display a formatted date from ISO

Chain `ToDate` and `Date.Format` to render a stored ISO string in a
readable format:

```rust
answer("dateOfBirth").pipe([transformer::string::to_date(), transformer::date::format("D MMMM YYYY")])
// "2024-03-15" -> "15 March 2024"
```
