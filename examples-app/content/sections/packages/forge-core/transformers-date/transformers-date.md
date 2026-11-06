---
title: Dates
section: packages
path: packages/forge-core/transformers-date
teaches: [transformer::date, date-transformers, date-formatting]
prerequisites: [forge-core, transformers]
---

<p class="govuk-caption-xl">Forge Core</p>

# Date transformers
Date transformers format, shift, and convert Date objects. They are
applied through `.pipe()` on references or generators that resolve
to a Date.

{{slot:toc}}

---

## How to use them

Date transformers are called as `transformer::date::<name>()` and
applied with `.pipe()`. The input must be a Date object - if your
source is a string, parse it first with `transformer::string::to_date()`
or `transformer::string::to_timestamp_date()`.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

generator::date::today().pipe([transformer::date::format("D MMMM YYYY")])
generator::date::today().pipe([transformer::date::add_days(7)])
```

Chain with string transformers to go from a stored ISO string to a
formatted display value:

```rust
answer("dateOfBirth").pipe([transformer::string::to_date(), transformer::date::format("D MMMM YYYY")])
// "2024-03-15" -> "15 March 2024"
```

All arguments that accept a number or string also accept an
expression.

---

## Formatting

### Format

Formats a Date into a string using token-based patterns.

```rust
generator::date::today().pipe([transformer::date::format("DD/MM/YYYY")])
// Date(2024-03-15) -> "15/03/2024"
generator::date::today().pipe([transformer::date::format("D MMMM YYYY")])
// Date(2024-03-15) -> "15 March 2024"
generator::date::now().pipe([transformer::date::format("HH:mm")])
// Date(2024-03-15T14:30:00) -> "14:30"
```

**Supported tokens:**

| Token | Output | Example |
|---|---|---|
| `YYYY` | 4-digit year | 2024 |
| `YY` | 2-digit year | 24 |
| `MMMM` | Full month name | March |
| `MM` | 2-digit month | 03 |
| `M` | Month | 3 |
| `DD` | 2-digit day | 05 |
| `Do` | Ordinal day | 5th |
| `D` | Day | 5 |
| `HH` | 2-digit hours (24h) | 09 |
| `H` | Hours (24h) | 9 |
| `mm` | 2-digit minutes | 05 |
| `m` | Minutes | 5 |
| `ss` | 2-digit seconds | 08 |
| `s` | Seconds | 8 |

Any characters in the format string that are not tokens are passed
through as-is, so `"DD/MM/YYYY"` produces `"15/03/2024"`.

### ToISOString

Converts a Date to its full ISO 8601 string representation.

```rust
generator::date::now().pipe([transformer::date::to_iso_string()])
// Date(2024-03-15T14:30:45.123Z) -> "2024-03-15T14:30:45.123Z"
```

### ToLocaleString

Converts a Date to a locale-specific string. Defaults to the
server's locale when no argument is provided.

```rust
generator::date::now().pipe([transformer::date::to_locale_string("en-GB")])
// Date(2024-03-15T14:30:45) -> "15/03/2024, 14:30:45"
generator::date::now().pipe([transformer::date::to_locale_string("en-US")])
// Date(2024-03-15T14:30:45) -> "3/15/2024, 2:30:45 PM"
```

### ToUKLongDate

Formats a Date in UK long date format: day, full month name, year.

```rust
generator::date::today().pipe([transformer::date::to_uk_long_date()])
// Date(2024-03-15) -> "15 March 2024"
```

---

## Arithmetic

All arithmetic transformers return a new Date object - they do not
mutate the input.

### AddDays

Adds a number of days. Use negative values to subtract.

```rust
generator::date::today().pipe([transformer::date::add_days(7)])
// 15 March 2024 -> 22 March 2024
generator::date::today().pipe([transformer::date::add_days(-1)])
// 15 March 2024 -> 14 March 2024
```

### SubtractDays

Subtracts a number of days.

```rust
generator::date::today().pipe([transformer::date::subtract_days(30)])
// 15 March 2024 -> 14 February 2024
```

### AddMonths

Adds a number of months. Use negative values to subtract.

```rust
generator::date::today().pipe([transformer::date::add_months(3)])
// 15 March 2024 -> 15 June 2024
generator::date::today().pipe([transformer::date::add_months(-6)])
// 15 March 2024 -> 15 September 2023
```

### AddYears

Adds a number of years. Use negative values to subtract.

```rust
generator::date::today().pipe([transformer::date::add_years(1)])
// 15 March 2024 -> 15 March 2025
generator::date::today().pipe([transformer::date::add_years(-18)])
// 15 March 2024 -> 15 March 2006
```

---

## Day boundaries

### StartOfDay

Sets the time to midnight (00:00:00.000).

```rust
generator::date::now().pipe([transformer::date::start_of_day()])
// 2024-03-15T14:30:45.123 -> 2024-03-15T00:00:00.000
```

### EndOfDay

Sets the time to the last millisecond of the day (23:59:59.999).

```rust
generator::date::now().pipe([transformer::date::end_of_day()])
// 2024-03-15T14:30:45.123 -> 2024-03-15T23:59:59.999
```

---

## Practical examples

### Display a formatted date of birth

Parse a stored ISO string and format it for a summary list:

```rust
answer("dateOfBirth").pipe([transformer::string::to_date(), transformer::date::format("D MMMM YYYY")])
// "1990-06-21" -> "21 June 1990"
```

### Calculate a deadline

Add 28 days to today and format it:

```rust
generator::date::today().pipe([transformer::date::add_days(28), transformer::date::format("D MMMM YYYY")])
// "12 May 2024" (if today is 14 April 2024)
```

### Calculate minimum age date

Subtract 18 years from today to get the latest date of birth for an
18-year-old:

```rust
generator::date::today().pipe([transformer::date::add_years(-18), transformer::date::format("YYYY-MM-DD")])
// "2006-04-14" (if today is 14 April 2024)
```

### Show the current date on a page

```rust
govuk::BODY.build(obj! {
    "text": format("Today is %1", [generator::date::today().pipe([transformer::date::to_uk_long_date()]).into()]),
})
```
