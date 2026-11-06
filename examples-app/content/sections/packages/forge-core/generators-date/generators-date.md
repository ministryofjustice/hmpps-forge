---
title: Dates
section: packages
path: packages/forge-core/generators-date
teaches: [generator::date, date-generators, generator::date::now, generator::date::today]
prerequisites: [forge-core, generators]
---

<p class="govuk-caption-xl">Forge Core</p>

# Date generators
Date generators produce date values at runtime. Where references
look up existing data, generators create new values each time they
are evaluated. Forge ships with two date generators; custom
generators can be defined for other value types.

{{slot:toc}}

---

## How to use them

Date generators are called as `generator::date::<name>()` and can be
used anywhere an expression is accepted. They return a Date object
that can be piped through transformers.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

generator::date::today()
generator::date::now().pipe([transformer::date::format("DD/MM/YYYY")])
generator::date::today().pipe([transformer::date::add_days(28)])
```

---

## Generators

### Now

Produces the current date and time as a Date object with the full
timestamp.

```rust
generator::date::now()
// Date(2024-03-15T14:30:45.123)
```

Use `Now` when you need the exact moment, including hours, minutes,
and seconds:

```rust
generator::date::now().pipe([transformer::date::format("DD/MM/YYYY HH:mm")])
// "15/03/2024 14:30"
```

### Today

Produces today's date at midnight (00:00:00.000). Use this when you
need a date without a time component.

```rust
generator::date::today()
// Date(2024-03-15T00:00:00.000)
```

`Today` is the right choice for date comparisons and display where
the time of day is irrelevant:

```rust
generator::date::today().pipe([transformer::date::format("D MMMM YYYY")])
// "15 March 2024"
```

---

## Practical examples

### Display today's date on a page

```rust
govuk::BODY.build(obj! {
    "text": format("Today is %1", [generator::date::today().pipe([transformer::date::to_uk_long_date()]).into()]),
})
```

### Calculate a deadline

Add 28 days to today and format for display:

```rust
govuk::BODY.build(obj! {
    "text": format("You must respond by %1", [generator::date::today().pipe([transformer::date::add_days(28), transformer::date::format("D MMMM YYYY")]).into()]),
})
```

### Set a minimum date for validation

Check that a user-entered date is in the future:

```rust
validation(obj! {
    "condition": self_().matches(condition::date::is_future_date()),
    "message": "Date must be in the future",
})
```

### Calculate a date boundary

Subtract 18 years from today to determine the latest valid date
of birth for an adult:

```rust
generator::date::today().pipe([transformer::date::add_years(-18), transformer::date::format("YYYY-MM-DD")])
```
