---
title: Textarea
section: packages
path: packages/govuk-components/textarea-input
teaches: [govuk::TEXTAREA, textarea-input, govuk-textarea-input]
prerequisites: [govuk-components-package, block, validation]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Textarea

A multi-line text input for longer free-text answers. The component
renders the GOV.UK Design System textarea and supports configurable
rows, hints, spellcheck control, and validation.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::TEXTAREA` from the GOV.UK components package.
Every textarea needs a `code` and a `label`.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::TEXTAREA.build(obj! {
    "code": "feedback",
    "label": "Give your feedback",
})
```

---

## Label

The label can be a plain string or an object. Use
`"isPageHeading": true` when the textarea is the only question on the
page.

```rust
govuk::TEXTAREA.build(obj! {
    "code": "feedback",
    "label": obj! {
        "text": "What could we improve?",
        "classes": classes::label::LARGE,
        "isPageHeading": true,
    },
})
```

---

## Hint

Add guidance below the label with the `hint` property.

```rust
govuk::TEXTAREA.build(obj! {
    "code": "description",
    "label": "Describe the incident",
    "hint": "Include the date, time, and location. Do not include personal details of other people.",
})
```

---

## Additional descriptions

Use `describedBy` to add extra element IDs to the textarea's
`aria-describedby` attribute. This is useful when another element on
the page provides guidance that should be announced by screen readers.

```rust
govuk::TEXTAREA.build(obj! {
    "code": "description",
    "label": "Describe the incident",
    "describedBy": "description-guidance",
})
```

---

## Rows

Set the initial height of the textarea with the `rows` property.
The default is 5 rows.

```rust
govuk::TEXTAREA.build(obj! {
    "code": "notes",
    "label": "Brief notes",
    "rows": "3",
})
govuk::TEXTAREA.build(obj! {
    "code": "fullAccount",
    "label": "Full account of events",
    "rows": "10",
})
```

---

## Spellcheck

Disable spellcheck for fields where the browser's suggestions are
unhelpful, such as reference numbers or code.

```rust
govuk::TEXTAREA.build(obj! {
    "code": "jsonPayload",
    "label": "JSON payload",
    "spellcheck": false,
})
```

---

## Formatting

Use `formatters` to clean submitted values before they are stored.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::TEXTAREA.build(obj! {
    "code": "feedback",
    "label": "Give your feedback",
    "formatters": [transformer::string::trim()],
})
```

---

## Validation

Use `validWhen` to add validation rules. Combine `condition::is_required()` with
`condition::string::has_max_length()` to enforce a character limit.

```rust
govuk::TEXTAREA.build(obj! {
    "code": "description",
    "label": "Describe the incident",
    "formatters": [transformer::string::trim()],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a description",
        }),
        validation(obj! {
            "condition": self_().matches(condition::string::has_max_length(2000)),
            "message": "Description must be 2,000 characters or less",
        }),
    ],
})
```

---

## Practical examples

### Detailed description

{{slot:description-example}}

```rust
govuk::TEXTAREA.build(obj! {
    "code": "incidentDescription",
    "label": obj! {
        "text": "Describe the incident",
        "classes": classes::label::MEDIUM,
    },
    "hint": "Include the date, time, and location.",
    "rows": "8",
    "formatters": [transformer::string::trim()],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a description of the incident",
        }),
        validation(obj! {
            "condition": self_().matches(condition::string::has_max_length(2000)),
            "message": "Description must be 2,000 characters or less",
        }),
    ],
})
```

### Short notes field

{{slot:notes-example}}

```rust
govuk::TEXTAREA.build(obj! {
    "code": "additionalNotes",
    "label": "Additional notes",
    "hint": "Enter any extra information, or \"None\".",
    "rows": "3",
    "formatters": [transformer::string::trim()],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter additional notes or \"None\"",
        }),
    ],
})
```
