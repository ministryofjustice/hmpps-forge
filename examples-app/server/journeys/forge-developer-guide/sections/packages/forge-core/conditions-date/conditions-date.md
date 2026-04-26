---
title: Dates
section: packages
path: packages/forge-core/conditions-date
teaches: [Condition.Date, date-conditions]
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
`Transformer.Date.Format('YYYY-MM-DD')`.

```typescript
import { Self, Condition } from '@ministryofjustice/hmpps-forge/core/authoring'

Self().match(Condition.Date.IsValid())
Self().match(Condition.Date.IsPastDate())
Self().match(Condition.Date.IsBefore('2030-01-01'))
```

---

## Format validation

### IsValid

Returns true if the value is a valid ISO date string with a real
calendar date.

```typescript
validation({
  condition: Self().match(Condition.Date.IsValid()),
  message: 'Enter a valid date',
})
```

### IsValidYear

Returns true if the year component is between 1000 and 9999.

```typescript
validation({
  condition: Self().match(Condition.Date.IsValidYear()),
  message: 'Year must be a 4-digit number',
})
```

### IsValidMonth

Returns true if the month component is between 1 and 12.

```typescript
validation({
  condition: Self().match(Condition.Date.IsValidMonth()),
  message: 'Month must be between 1 and 12',
})
```

### IsValidDay

Returns true if the day component is valid for the specific month
and year. Handles leap years and varying month lengths.

```typescript
validation({
  condition: Self().match(Condition.Date.IsValidDay()),
  message: 'Enter a real date',
})
// "2024-02-29" -> true (leap year)
// "2023-02-29" -> false (not a leap year)
```

---

## Comparisons

### IsBefore

Returns true if the date is before the comparison date. The argument
is an ISO date string or an expression that resolves to one.

```typescript
Self().match(Condition.Date.IsBefore('2030-01-01'))
Self().match(Condition.Date.IsBefore(Data('deadline')))
```

### IsAfter

Returns true if the date is after the comparison date.

```typescript
Self().match(Condition.Date.IsAfter('2000-01-01'))
Self().match(Condition.Date.IsAfter(Data('startDate')))
```

### IsFutureDate

Returns true if the date is after today.

```typescript
validation({
  condition: Self().match(Condition.Date.IsFutureDate()),
  message: 'Date must be in the future',
})
```

### IsPastDate

Returns true if the date is before today.

```typescript
validation({
  condition: Self().match(Condition.Date.IsPastDate()),
  message: 'Date of birth must be in the past',
})
```

### IsToday

Returns true if the date is today.

```typescript
Self().match(Condition.Date.IsToday())
```

---

## Practical examples

### Date of birth validation

Validate that a date is real and in the past:

```typescript
validWhen: [
  validation({
    condition: Self().match(Condition.Date.IsValid()),
    message: 'Enter a valid date',
  }),
  validation({
    condition: Self().match(Condition.Date.IsPastDate()),
    message: 'Date of birth must be in the past',
  }),
]
```

### Appointment date must be in the future

```typescript
validWhen: [
  validation({
    condition: Self().match(Condition.Date.IsValid()),
    message: 'Enter a valid date',
  }),
  validation({
    condition: Self().match(Condition.Date.IsFutureDate()),
    message: 'Appointment date must be in the future',
  }),
]
```

### Date range check

Ensure a date falls between two boundaries:

```typescript
validWhen: [
  validation({
    condition: Self().match(Condition.Date.IsAfter(Data('periodStart'))),
    message: 'Date must be after the start of the period',
  }),
  validation({
    condition: Self().match(Condition.Date.IsBefore(Data('periodEnd'))),
    message: 'Date must be before the end of the period',
  }),
]
```
