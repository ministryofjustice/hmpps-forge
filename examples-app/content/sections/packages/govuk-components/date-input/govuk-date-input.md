---
title: Date Input
section: packages
path: packages/govuk-components/date-input
teaches: [govuk::DATE_INPUT_FULL, govuk::DATE_INPUT_YEAR_MONTH, govuk::DATE_INPUT_MONTH_DAY, date-input, validations::date_input_full]
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
most common is `govuk::DATE_INPUT_FULL`, which collects day, month, and
year.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::DATE_INPUT_FULL.build(obj! {
    "code": "dateOfBirth",
    "fieldset": obj! {
        "legend": obj! { "text": "Date of birth" },
    },
    "hint": "For example, 27 3 1990",
})
```

The submitted value is stored as an ISO date string (`YYYY-MM-DD`).
The component automatically converts between the three separate
fields and the stored string.

---

## Variants

### GovUKDateInputFull

Collects day, month, and year. Stores as `YYYY-MM-DD`.

```rust
govuk::DATE_INPUT_FULL.build(obj! {
    "code": "startDate",
    "fieldset": obj! {
        "legend": obj! { "text": "When did you start?" },
    },
    "hint": "For example, 12 11 2024",
})
```

### GovUKDateInputYearMonth

Collects month and year only. Stores as `YYYY-MM`. Use this when the
day is not relevant, such as an expiry date.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::DATE_INPUT_YEAR_MONTH.build(obj! {
    "code": "expiryDate",
    "fieldset": obj! {
        "legend": obj! { "text": "Expiry date" },
    },
    "hint": "For example, 3 2026",
})
```

### GovUKDateInputMonthDay

Collects day and month only. Stores as `MM-DD`. Use this for
recurring annual dates like a birthday reminder.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::DATE_INPUT_MONTH_DAY.build(obj! {
    "code": "anniversary",
    "fieldset": obj! {
        "legend": obj! { "text": "Anniversary date" },
    },
    "hint": "For example, 14 2",
})
```

---

## Fieldset and legend

Date inputs are always wrapped in a fieldset. When the date input is
the only question on the page, set `"isPageHeading": true`.

```rust
govuk::DATE_INPUT_FULL.build(obj! {
    "code": "dateOfBirth",
    "fieldset": obj! {
        "legend": obj! {
            "text": "What is your date of birth?",
            "classes": classes::fieldset::LARGE_LABEL,
            "isPageHeading": true,
        },
    },
    "hint": "For example, 27 3 1990",
})
```

---

## Validation

Use `validations::date_input_full()` for comprehensive date
validation. It generates rules for empty input, missing individual
fields, invalid dates, and optionally past or future checks.

{{slot:validation-example}}

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;
use forge_govuk_components::validations;

govuk::DATE_INPUT_FULL.build(obj! {
    "code": "dateOfBirth",
    "fieldset": obj! {
        "legend": obj! {
            "text": "What is your date of birth?",
            "classes": classes::fieldset::LARGE_LABEL,
            "isPageHeading": true,
        },
    },
    "hint": "For example, 27 3 1990",
    "validWhen": concat([
        validations::date_input_full(obj! {
            "empty": obj! { "message": "Enter your date of birth" },
            "missingDay": obj! { "message": "Date of birth must include a day" },
            "missingMonth": obj! { "message": "Date of birth must include a month" },
            "missingYear": obj! { "message": "Date of birth must include a year" },
            "invalid": obj! { "message": "Date of birth must be a real date" },
            "mustBePast": obj! { "message": "Date of birth must be in the past", "submissionOnly": true },
        }),
    ]),
})
```

The validation helper highlights the specific field that has an error
(day, month, or year) rather than the whole group.

---

## Practical examples

### Start date (future only)

{{slot:start-date-example}}

```rust
govuk::DATE_INPUT_FULL.build(obj! {
    "code": "startDate",
    "fieldset": obj! {
        "legend": obj! { "text": "When do you want to start?" },
    },
    "hint": "For example, 27 3 2025",
    "validWhen": concat([
        validations::date_input_full(obj! {
            "empty": obj! { "message": "Enter a start date" },
            "missingDay": obj! { "message": "Start date must include a day" },
            "missingMonth": obj! { "message": "Start date must include a month" },
            "missingYear": obj! { "message": "Start date must include a year" },
            "invalid": obj! { "message": "Start date must be a real date" },
            "mustBeFuture": obj! { "message": "Start date must be in the future", "submissionOnly": true },
        }),
    ]),
})
```
