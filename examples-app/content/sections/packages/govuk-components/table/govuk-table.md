---
title: Table
section: packages
path: packages/govuk-components/table
teaches: [govuk::TABLE, table, govuk-table]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Table

A data table for displaying tabular information. The component
renders the GOV.UK Design System table and supports headers,
captions, row header cells, and dynamic data.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::TABLE` from the GOV.UK components package. The `rows`
property is an array of row arrays, where each cell has a `text` or
`core_blocks::HTML` property, or a `blocks` array for nested Forge blocks.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::TABLE.build(obj! {
    "rows": [
        [obj! { "text": "January" }, obj! { "text": "£85" }],
        [obj! { "text": "February" }, obj! { "text": "£165" }],
        [obj! { "text": "March" }, obj! { "text": "£230" }],
    ],
})
```

---

## Headers

Add column headers with the `head` property.

{{slot:header-example}}

```rust
govuk::TABLE.build(obj! {
    "head": [obj! { "text": "Month" }, obj! { "text": "Amount" }],
    "rows": [
        [obj! { "text": "January" }, obj! { "text": "£85" }],
        [obj! { "text": "February" }, obj! { "text": "£165" }],
        [obj! { "text": "March" }, obj! { "text": "£230" }],
    ],
})
```

---

## Caption

Add a visible caption above the table to describe its contents. Use
`captionClasses` to control the size.

{{slot:caption-example}}

```rust
govuk::TABLE.build(obj! {
    "caption": "Monthly expenses",
    "captionClasses": "govuk-table__caption--m",
    "head": [obj! { "text": "Month" }, obj! { "text": "Amount" }],
    "rows": [
        [obj! { "text": "January" }, obj! { "text": "£85" }],
        [obj! { "text": "February" }, obj! { "text": "£165" }],
        [obj! { "text": "March" }, obj! { "text": "£230" }],
    ],
})
```

---

## Row headers

Set `"firstCellIsHeader": true` to render the first cell of each row
as a `<th>` element. Use this when the first column identifies the
row.

```rust
govuk::TABLE.build(obj! {
    "firstCellIsHeader": true,
    "head": [obj! { "text": "Name" }, obj! { "text": "Role" }, obj! { "text": "Status" }],
    "rows": [
        [obj! { "text": "Sarah" }, obj! { "text": "Caseworker" }, obj! { "text": "Active" }],
        [obj! { "text": "James" }, obj! { "text": "Manager" }, obj! { "text": "Active" }],
    ],
})
```

---

## Numeric columns

Right-align numeric columns using the `format` property on header
and body cells.

```rust
"head": [obj! { "text": "Month" }, obj! { "text": "Amount", "format": "numeric" }],
"rows": [[obj! { "text": "January" }, obj! { "text": "£85", "format": "numeric" }]],
```

---

## Nested blocks

Nest blocks in the `blocks` property on table cells.

{{slot:nested-block-example}}

```rust
govuk::TABLE.build(obj! {
    "rows": [
        [obj! { "text": "Status" }, obj! { "blocks": [govuk::TAG.build(obj! { "text": "Completed" })] }],
    ],
})
```
