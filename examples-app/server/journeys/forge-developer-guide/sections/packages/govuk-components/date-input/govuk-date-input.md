---
title: Date Input
section: packages
path: packages/govuk-components/date-input
teaches: [GovUKDateInputFull, GovUKDateInputYearMonth, GovUKDateInputMonthDay, date-input, GovUKValidations.DateInputFull]
prerequisites: [govuk-components-package, block, validation]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Date input

A composite input that collects a date as separate day, month, and
year fields. The component handles formatting the individual fields
into an ISO date string and parsing it back for display. Three
variants are available depending on which date parts you need.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import the variant you need from the GOV.UK components package. The
most common is `GovUKDateInputFull`, which collects day, month, and
year.

```typescript
import { GovUKDateInputFull } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKDateInputFull({
  code: 'dateOfBirth',
  fieldset: {
    legend: { text: 'Date of birth' },
  },
  hint: 'For example, 27 3 1990',
})
```

The submitted value is stored as an ISO date string (`YYYY-MM-DD`).
The component automatically converts between the three separate
fields and the stored string.

---

## Variants

### GovUKDateInputFull

Collects day, month, and year. Stores as `YYYY-MM-DD`.

```typescript
GovUKDateInputFull({
  code: 'startDate',
  fieldset: {
    legend: { text: 'When did you start?' },
  },
  hint: 'For example, 12 11 2024',
})
```

### GovUKDateInputYearMonth

Collects month and year only. Stores as `YYYY-MM`. Use this when the
day is not relevant, such as an expiry date.

```typescript
import { GovUKDateInputYearMonth } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKDateInputYearMonth({
  code: 'expiryDate',
  fieldset: {
    legend: { text: 'Expiry date' },
  },
  hint: 'For example, 3 2026',
})
```

### GovUKDateInputMonthDay

Collects day and month only. Stores as `MM-DD`. Use this for
recurring annual dates like a birthday reminder.

```typescript
import { GovUKDateInputMonthDay } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKDateInputMonthDay({
  code: 'anniversary',
  fieldset: {
    legend: { text: 'Anniversary date' },
  },
  hint: 'For example, 14 2',
})
```

---

## Fieldset and legend

Date inputs are always wrapped in a fieldset. When the date input is
the only question on the page, set `isPageHeading: true`.

```typescript
GovUKDateInputFull({
  code: 'dateOfBirth',
  fieldset: {
    legend: {
      text: 'What is your date of birth?',
      classes: GovUKUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  hint: 'For example, 27 3 1990',
})
```

---

## Validation

Use `GovUKValidations.DateInputFull()` for comprehensive date
validation. It generates rules for empty input, missing individual
fields, invalid dates, and optionally past or future checks.

{{slot:validation-example}}

```typescript
import { GovUKValidations } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKDateInputFull({
  code: 'dateOfBirth',
  fieldset: {
    legend: {
      text: 'What is your date of birth?',
      classes: GovUKUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  hint: 'For example, 27 3 1990',
  validWhen: [
    ...GovUKValidations.DateInputFull({
      empty: { message: 'Enter your date of birth' },
      missingDay: { message: 'Date of birth must include a day' },
      missingMonth: { message: 'Date of birth must include a month' },
      missingYear: { message: 'Date of birth must include a year' },
      invalid: { message: 'Date of birth must be a real date' },
      mustBePast: { message: 'Date of birth must be in the past', submissionOnly: true },
    }),
  ],
})
```

The validation helper highlights the specific field that has an error
(day, month, or year) rather than the whole group.

---

## Practical examples

### Start date (future only)

{{slot:start-date-example}}

```typescript
GovUKDateInputFull({
  code: 'startDate',
  fieldset: {
    legend: { text: 'When do you want to start?' },
  },
  hint: 'For example, 27 3 2025',
  validWhen: [
    ...GovUKValidations.DateInputFull({
      empty: { message: 'Enter a start date' },
      missingDay: { message: 'Start date must include a day' },
      missingMonth: { message: 'Start date must include a month' },
      missingYear: { message: 'Start date must include a year' },
      invalid: { message: 'Start date must be a real date' },
      mustBeFuture: { message: 'Start date must be in the future', submissionOnly: true },
    }),
  ],
})
```
