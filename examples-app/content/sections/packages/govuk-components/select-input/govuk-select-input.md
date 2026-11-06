---
title: Select
section: packages
path: packages/govuk-components/select-input
teaches: [govuk::SELECT_INPUT, select-input, govuk-select-input, visibleWhen]
prerequisites: [govuk-components-package, block, validation]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Select

A dropdown select field that lets the user choose a single option
from a list. The component renders the GOV.UK Design System select
component and supports static items, dynamic items from data, hints,
and validation.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::SELECT_INPUT` from the GOV.UK components package. Every
select needs a `code`, a `label`, and an `items` array.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::SELECT_INPUT.build(obj! {
    "code": "country",
    "label": "Country",
    "items": [
        obj! { "value": "", "text": "Choose a country" },
        obj! { "value": "uk", "text": "United Kingdom" },
        obj! { "value": "fr", "text": "France" },
        obj! { "value": "de", "text": "Germany" },
    ],
})
```

Always include a blank placeholder option as the first item so the
select does not default to a real value.

---

## Label

The label can be a plain string or an object. Use
`"isPageHeading": true` when the select is the only question on the
page.

```rust
govuk::SELECT_INPUT.build(obj! {
    "code": "relationship",
    "label": obj! {
        "text": "What is your relationship to the prisoner?",
        "classes": classes::label::LARGE,
        "isPageHeading": true,
    },
    "items": [
        obj! { "value": "", "text": "Choose a relationship" },
        obj! { "value": "partner", "text": "Partner or spouse" },
        obj! { "value": "parent", "text": "Parent" },
        obj! { "value": "sibling", "text": "Brother or sister" },
        obj! { "value": "friend", "text": "Friend" },
    ],
})
```

---

## Hint

Add guidance below the label with the `hint` property.

```rust
govuk::SELECT_INPUT.build(obj! {
    "code": "country",
    "label": "Country of residence",
    "hint": "Select the country where you currently live.",
    "items": [
        obj! { "value": "", "text": "Choose a country" },
        obj! { "value": "uk", "text": "United Kingdom" },
        obj! { "value": "fr", "text": "France" },
    ],
})
```

---

## Additional descriptions

Use `describedBy` to add extra element IDs to the select's
`aria-describedby` attribute. This is useful when another element on
the page provides guidance that should be announced by screen readers.

```rust
govuk::SELECT_INPUT.build(obj! {
    "code": "country",
    "label": "Country",
    "describedBy": "country-guidance",
    "items": [
        obj! { "value": "", "text": "Choose a country" },
        obj! { "value": "uk", "text": "United Kingdom" },
    ],
})
```

---

## Disabled options

Disable individual items to prevent selection while keeping them
visible in the list.

```rust
"items": [
    obj! { "value": "", "text": "Choose an option", "disabled": true },
    obj! { "value": "uk", "text": "United Kingdom" },
    obj! { "value": "fr", "text": "France" },
],
```

---

## Conditional items

Use `visibleWhen` on an item to omit it from rendering. This only
controls presentation. It does not clear or reject a previously stored
answer; use `dependentWhen`, validation, or a hook when the answer
itself should no longer apply.

```rust
govuk::SELECT_INPUT.build(obj! {
    "code": "country",
    "label": "Country",
    "items": [
        obj! { "value": "", "text": "Choose a country" },
        obj! { "value": "uk", "text": "United Kingdom" },
        obj! {
            "value": "fr",
            "text": "France",
            "visibleWhen": data("showEuropeanCountries"),
        },
    ],
})
```

---

## Dynamic items from data

Load items from an API or data source using `data()` with iterators.
The select renders whatever items are in the data at request time.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::SELECT_INPUT.build(obj! {
    "code": "country",
    "label": "Country",
    "items": data("countries").each(iterator::map(obj! {
        "value": item().path("code"),
        "text": item().path("name"),
    })),
})
```

---

## Validation

Use `validWhen` to require a selection. The placeholder option with
an empty `value` will fail `condition::is_required()`.

```rust
govuk::SELECT_INPUT.build(obj! {
    "code": "country",
    "label": "Country",
    "items": [
        obj! { "value": "", "text": "Choose a country" },
        obj! { "value": "uk", "text": "United Kingdom" },
        obj! { "value": "fr", "text": "France" },
    ],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select a country",
        }),
    ],
})
```

---

## Practical examples

### Relationship selector

{{slot:relationship-example}}

```rust
govuk::SELECT_INPUT.build(obj! {
    "code": "relationship",
    "label": obj! {
        "text": "Relationship",
        "classes": classes::label::MEDIUM,
    },
    "items": [
        obj! { "value": "", "text": "Choose a relationship" },
        obj! { "value": "partner", "text": "Partner or spouse" },
        obj! { "value": "parent", "text": "Parent" },
        obj! { "value": "child", "text": "Son or daughter" },
        obj! { "value": "sibling", "text": "Brother or sister" },
        obj! { "value": "friend", "text": "Friend" },
        obj! { "value": "other", "text": "Other" },
    ],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select your relationship",
        }),
    ],
})
```
