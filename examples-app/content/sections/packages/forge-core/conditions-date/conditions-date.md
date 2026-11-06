---
title: Dates
section: packages
path: packages/forge-core/conditions-date
teaches: [condition::date, date-conditions]
prerequisites: [forge-core, conditions]
---

<p class="govuk-caption-xl">Forge Core</p>

# Date conditions
Date conditions validate and compare ISO 8601 date strings
(YYYY-MM-DD). They check format validity, component validity, and
temporal relationships like before, after, and today.

{{slot:toc}}

---

## How to use them

Date conditions operate on ISO date strings, not Date objects. If
your field stores dates as objects, convert them first with
`transformer::date::format("YYYY-MM-DD")`.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

self_().matches(condition::date::is_valid())
self_().matches(condition::date::is_past_date())
self_().matches(condition::date::is_before("2030-01-01"))
```

---

## Format validation

### IsValid

Returns true if the value is a valid ISO date string with a real
calendar date.

```rust
validation(obj! {
    "condition": self_().matches(condition::date::is_valid()),
    "message": "Enter a valid date",
})
```

### IsValidYear

Returns true if the year component is between 1000 and 9999.

```rust
validation(obj! {
    "condition": self_().matches(condition::date::is_valid_year()),
    "message": "Year must be a 4-digit number",
})
```

### IsValidMonth

Returns true if the month component is between 1 and 12.

```rust
validation(obj! {
    "condition": self_().matches(condition::date::is_valid_month()),
    "message": "Month must be between 1 and 12",
})
```

### IsValidDay

Returns true if the day component is valid for the specific month
and year. Handles leap years and varying month lengths.

```rust
validation(obj! {
    "condition": self_().matches(condition::date::is_valid_day()),
    "message": "Enter a real date",
})
// "2024-02-29" -> true (leap year)
// "2023-02-29" -> false (not a leap year)
```

---

## Comparisons

### IsBefore

Returns true if the date is before the comparison date. The argument
is an ISO date string or an expression that resolves to one.

```rust
self_().matches(condition::date::is_before("2030-01-01"))
self_().matches(condition::date::is_before(data("deadline")))
```

### IsAfter

Returns true if the date is after the comparison date.

```rust
self_().matches(condition::date::is_after("2000-01-01"))
self_().matches(condition::date::is_after(data("startDate")))
```

### IsFutureDate

Returns true if the date is after today.

```rust
validation(obj! {
    "condition": self_().matches(condition::date::is_future_date()),
    "message": "Date must be in the future",
})
```

### IsPastDate

Returns true if the date is before today.

```rust
validation(obj! {
    "condition": self_().matches(condition::date::is_past_date()),
    "message": "Date of birth must be in the past",
})
```

### IsToday

Returns true if the date is today.

```rust
self_().matches(condition::date::is_today())
```

---

## Practical examples

### Date of birth validation

Validate that a date is real and in the past:

```rust
"validWhen": [
    validation(obj! {
        "condition": self_().matches(condition::date::is_valid()),
        "message": "Enter a valid date",
    }),
    validation(obj! {
        "condition": self_().matches(condition::date::is_past_date()),
        "message": "Date of birth must be in the past",
    }),
],
```

### Appointment date must be in the future

```rust
"validWhen": [
    validation(obj! {
        "condition": self_().matches(condition::date::is_valid()),
        "message": "Enter a valid date",
    }),
    validation(obj! {
        "condition": self_().matches(condition::date::is_future_date()),
        "message": "Appointment date must be in the future",
    }),
],
```

### Date range check

Ensure a date falls between two boundaries:

```rust
"validWhen": [
    validation(obj! {
        "condition": self_().matches(condition::date::is_after(data("periodStart"))),
        "message": "Date must be after the start of the period",
    }),
    validation(obj! {
        "condition": self_().matches(condition::date::is_before(data("periodEnd"))),
        "message": "Date must be before the end of the period",
    }),
],
```
