---
title: Dates
section: packages
path: packages/forge-core/transformers-date
teaches: [Transformer.Date, date-transformers, date-formatting]
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

Date transformers are called as `Transformer.Date.<Name>()` and
applied with `.pipe()`. The input must be a Date object - if your
source is a string, parse it first with `Transformer.String.ToDate()`
or `Transformer.String.ToTimestampDate()`.

```typescript
import { Generator, Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

Generator.Date.Today().pipe(Transformer.Date.Format('D MMMM YYYY'))
Generator.Date.Today().pipe(Transformer.Date.AddDays(7))
```

Chain with string transformers to go from a stored ISO string to a
formatted display value:

```typescript
Answer('dateOfBirth').pipe(
  Transformer.String.ToDate(),
  Transformer.Date.Format('D MMMM YYYY'),
)
// "2024-03-15" -> "15 March 2024"
```

All arguments that accept a number or string also accept an
expression.

---

## Formatting

### Format

Formats a Date into a string using token-based patterns.

```typescript
Generator.Date.Today().pipe(Transformer.Date.Format('DD/MM/YYYY'))
// Date(2024-03-15) -> "15/03/2024"

Generator.Date.Today().pipe(Transformer.Date.Format('D MMMM YYYY'))
// Date(2024-03-15) -> "15 March 2024"

Generator.Date.Now().pipe(Transformer.Date.Format('HH:mm'))
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
through as-is, so `'DD/MM/YYYY'` produces `"15/03/2024"`.

### ToISOString

Converts a Date to its full ISO 8601 string representation.

```typescript
Generator.Date.Now().pipe(Transformer.Date.ToISOString())
// Date(2024-03-15T14:30:45.123Z) -> "2024-03-15T14:30:45.123Z"
```

### ToLocaleString

Converts a Date to a locale-specific string. Defaults to the
server's locale when no argument is provided.

```typescript
Generator.Date.Now().pipe(Transformer.Date.ToLocaleString('en-GB'))
// Date(2024-03-15T14:30:45) -> "15/03/2024, 14:30:45"

Generator.Date.Now().pipe(Transformer.Date.ToLocaleString('en-US'))
// Date(2024-03-15T14:30:45) -> "3/15/2024, 2:30:45 PM"
```

### ToUKLongDate

Formats a Date in UK long date format: day, full month name, year.

```typescript
Generator.Date.Today().pipe(Transformer.Date.ToUKLongDate())
// Date(2024-03-15) -> "15 March 2024"
```

---

## Arithmetic

All arithmetic transformers return a new Date object - they do not
mutate the input.

### AddDays

Adds a number of days. Use negative values to subtract.

```typescript
Generator.Date.Today().pipe(Transformer.Date.AddDays(7))
// 15 March 2024 -> 22 March 2024

Generator.Date.Today().pipe(Transformer.Date.AddDays(-1))
// 15 March 2024 -> 14 March 2024
```

### SubtractDays

Subtracts a number of days.

```typescript
Generator.Date.Today().pipe(Transformer.Date.SubtractDays(30))
// 15 March 2024 -> 14 February 2024
```

### AddMonths

Adds a number of months. Use negative values to subtract.

```typescript
Generator.Date.Today().pipe(Transformer.Date.AddMonths(3))
// 15 March 2024 -> 15 June 2024

Generator.Date.Today().pipe(Transformer.Date.AddMonths(-6))
// 15 March 2024 -> 15 September 2023
```

### AddYears

Adds a number of years. Use negative values to subtract.

```typescript
Generator.Date.Today().pipe(Transformer.Date.AddYears(1))
// 15 March 2024 -> 15 March 2025

Generator.Date.Today().pipe(Transformer.Date.AddYears(-18))
// 15 March 2024 -> 15 March 2006
```

---

## Day boundaries

### StartOfDay

Sets the time to midnight (00:00:00.000).

```typescript
Generator.Date.Now().pipe(Transformer.Date.StartOfDay())
// 2024-03-15T14:30:45.123 -> 2024-03-15T00:00:00.000
```

### EndOfDay

Sets the time to the last millisecond of the day (23:59:59.999).

```typescript
Generator.Date.Now().pipe(Transformer.Date.EndOfDay())
// 2024-03-15T14:30:45.123 -> 2024-03-15T23:59:59.999
```

---

## Practical examples

### Display a formatted date of birth

Parse a stored ISO string and format it for a summary list:

```typescript
Answer('dateOfBirth').pipe(
  Transformer.String.ToDate(),
  Transformer.Date.Format('D MMMM YYYY'),
)
// "1990-06-21" -> "21 June 1990"
```

### Calculate a deadline

Add 28 days to today and format it:

```typescript
Generator.Date.Today().pipe(
  Transformer.Date.AddDays(28),
  Transformer.Date.Format('D MMMM YYYY'),
)
// "12 May 2024" (if today is 14 April 2024)
```

### Calculate minimum age date

Subtract 18 years from today to get the latest date of birth for an
18-year-old:

```typescript
Generator.Date.Today().pipe(
  Transformer.Date.AddYears(-18),
  Transformer.Date.Format('YYYY-MM-DD'),
)
// "2006-04-14" (if today is 14 April 2024)
```

### Show the current date on a page

```typescript
GovUKBody({
  text: Format(
    'Today is %1',
    Generator.Date.Today().pipe(Transformer.Date.ToUKLongDate()),
  ),
})
```
