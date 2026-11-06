---
title: Date Picker
section: packages
path: packages/moj-components/date-picker
teaches: [moj::DATE_PICKER, date-picker, moj-date-picker]
prerequisites: [moj-components-package, block, validation]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Date picker

A date picker enhances a text input with a calendar button. Users can
choose a date from the calendar or type the date directly in
`dd/mm/yyyy` format.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `moj::DATE_PICKER` from the MOJ components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::DATE_PICKER.build(obj! {
    "code": "appointmentDate",
    "label": "Appointment date",
    "hint": "For example, 17/5/2026",
})
```

---

## Date limits

Use `minDate` and `maxDate` to limit dates in the calendar picker.
Users can still type other dates, so pair these limits with validation
when the rule matters.

{{slot:limits-example}}

```rust
moj::DATE_PICKER.build(obj! {
    "code": "visitDate",
    "label": "Visit date",
    "hint": "Choose a weekday in May 2026.",
    "minDate": "01/05/2026",
    "maxDate": "31/05/2026",
    "excludedDays": ["saturday", "sunday"],
})
```

---

## Label options

Use a label object when the date picker is the main question on the
page.

```rust
moj::DATE_PICKER.build(obj! {
    "code": "hearingDate",
    "label": obj! {
        "text": "When is the hearing?",
        "classes": "govuk-label--l",
        "isPageHeading": true,
    },
})
```
