---
title: Validations
section: packages
path: packages/govuk-components/validations
teaches: [validations, validations::date_input_full, govuk-validations]
prerequisites: [govuk-components-package, validation]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Validation helpers

Pre-built validation rule sets for composite components. These
helpers generate arrays of validation rules that handle the common
error cases for multi-field inputs.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

{{slot:toc}}

---

## DateInputFull

Generates a complete set of validation rules for `govuk::DATE_INPUT_FULL`
fields. It handles empty input, missing individual fields (day,
month, year), invalid dates, and optionally past or future checks.

```rust
govuk::DATE_INPUT_FULL.build(obj! {
    "code": "dateOfBirth",
    "fieldset": obj! {
        "legend": obj! { "text": "Date of birth" },
    },
    "validWhen": concat([
        validations::date_input_full(obj! {
            "empty": "Enter your date of birth",
            "missingDay": "Date of birth must include a day",
            "missingMonth": "Date of birth must include a month",
            "missingYear": "Date of birth must include a year",
            "invalid": "Date of birth must be a real date",
        }),
    ]),
})
```

---

### Parameters

| Parameter | Required | Description |
|---|---|---|
| `empty` | Yes | Message when all fields are empty |
| `missingDay` | Yes | Message when day is missing |
| `missingMonth` | Yes | Message when month is missing |
| `missingYear` | Yes | Message when year is missing |
| `invalid` | Yes | Message when the date is not real |
| `mustBePast` | No | Message when date must be in the past |
| `mustBeFuture` | No | Message when date must be in the future |

---

### String or object messages

Each parameter accepts a plain string or an object with `message`
and optional `submissionOnly`. Use `"submissionOnly": true` for checks
that should not run during journey traversal, such as temporal
checks that could fail on a previously valid step.

```rust
validations::date_input_full(obj! {
    "empty": "Enter a start date",
    "missingDay": "Start date must include a day",
    "missingMonth": "Start date must include a month",
    "missingYear": "Start date must include a year",
    "invalid": "Start date must be a real date",
    "mustBeFuture": obj! { "message": "Start date must be in the future", "submissionOnly": true },
})
```

---

### Field-specific errors

The helper uses the `details` property on each missing-field rule to
identify which sub-field caused the error. Components use this to
highlight just the day, month, or year input rather than the whole
group.

---

### What it generates

Spreading `validations::date_input_full()` into `validWhen`
produces up to 7 validation rules in this order:

1. **Empty** - all three fields are blank
2. **Missing day** - day field is blank but others are not
3. **Missing month** - month field is blank but others are not
4. **Missing year** - year field is blank but others are not
5. **Invalid** - the combined date is not a real calendar date
6. **Must be past** (optional) - date is in the future
7. **Must be future** (optional) - date is in the past
