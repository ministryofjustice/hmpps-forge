---
title: Dates
section: packages
path: packages/forge-core/generators-date
teaches: [Generator.Date, date-generators, Generator.Date.Now, Generator.Date.Today]
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

Date generators are called as `Generator.Date.<Name>()` and can be
used anywhere an expression is accepted. They return a Date object
that can be piped through transformers.

```typescript
import { Generator, Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

Generator.Date.Today()
Generator.Date.Now().pipe(Transformer.Date.Format('DD/MM/YYYY'))
Generator.Date.Today().pipe(Transformer.Date.AddDays(28))
```

---

## Generators

### Now

Produces the current date and time as a Date object with the full
timestamp.

```typescript
Generator.Date.Now()
// Date(2024-03-15T14:30:45.123)
```

Use `Now` when you need the exact moment, including hours, minutes,
and seconds:

```typescript
Generator.Date.Now().pipe(Transformer.Date.Format('DD/MM/YYYY HH:mm'))
// "15/03/2024 14:30"
```

### Today

Produces today's date at midnight (00:00:00.000). Use this when you
need a date without a time component.

```typescript
Generator.Date.Today()
// Date(2024-03-15T00:00:00.000)
```

`Today` is the right choice for date comparisons and display where
the time of day is irrelevant:

```typescript
Generator.Date.Today().pipe(Transformer.Date.Format('D MMMM YYYY'))
// "15 March 2024"
```

---

## Practical examples

### Display today's date on a page

```typescript
GovUKBody({
  text: Format('Today is %1', Generator.Date.Today().pipe(Transformer.Date.ToUKLongDate())),
})
```

### Calculate a deadline

Add 28 days to today and format for display:

```typescript
GovUKBody({
  text: Format(
    'You must respond by %1',
    Generator.Date.Today().pipe(
      Transformer.Date.AddDays(28),
      Transformer.Date.Format('D MMMM YYYY'),
    ),
  ),
})
```

### Set a minimum date for validation

Check that a user-entered date is in the future:

```typescript
validation({
  condition: Self().match(Condition.Date.IsFutureDate()),
  message: 'Date must be in the future',
})
```

### Calculate a date boundary

Subtract 18 years from today to determine the latest valid date
of birth for an adult:

```typescript
Generator.Date.Today().pipe(
  Transformer.Date.AddYears(-18),
  Transformer.Date.Format('YYYY-MM-DD'),
)
```
