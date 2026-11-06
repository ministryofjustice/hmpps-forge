---
title: Grid Row
section: packages
path: packages/govuk-components/grid-row
teaches: [govuk::GRID_ROW, grid-row, govuk-grid-row]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Grid row

A responsive grid layout with configurable columns. The component
renders the GOV.UK Design System grid system and supports all
standard column widths. Child blocks are placed inside each column.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::GRID_ROW` from the GOV.UK components package. Each
column has a `width` and an array of `blocks`.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::GRID_ROW.build(obj! {
    "columns": [
        obj! {
            "width": "one-half",
            "blocks": [govuk::BODY.build(obj! { "text": "Left column" })],
        },
        obj! {
            "width": "one-half",
            "blocks": [govuk::BODY.build(obj! { "text": "Right column" })],
        },
    ],
})
```

---

## Column widths

{{slot:widths-example}}

| Width | Fraction |
|---|---|
| `"full"` | 100% |
| `"three-quarters"` | 75% |
| `"two-thirds"` | 66% |
| `"one-half"` | 50% |
| `"one-third"` | 33% |
| `"one-quarter"` | 25% |
| `"one-sixth"` | 16% |

```rust
govuk::GRID_ROW.build(obj! {
    "columns": [
        obj! {
            "width": "two-thirds",
            "blocks": [govuk::BODY.build(obj! { "text": "Main content area" })],
        },
        obj! {
            "width": "one-third",
            "blocks": [govuk::BODY.build(obj! { "text": "Sidebar" })],
        },
    ],
})
```

---

## Three column layout

```rust
govuk::GRID_ROW.build(obj! {
    "columns": [
        obj! {
            "width": "one-third",
            "blocks": [govuk::BODY.build(obj! { "text": "Column 1" })],
        },
        obj! {
            "width": "one-third",
            "blocks": [govuk::BODY.build(obj! { "text": "Column 2" })],
        },
        obj! {
            "width": "one-third",
            "blocks": [govuk::BODY.build(obj! { "text": "Column 3" })],
        },
    ],
})
```
