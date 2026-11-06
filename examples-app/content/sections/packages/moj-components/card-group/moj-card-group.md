---
title: Card Group
section: packages
path: packages/moj-components/card-group
teaches: [moj::CARD_GROUP, card-group, moj-card-group]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Card group

A card group renders multiple MOJ cards in a responsive grid. Use it
for dashboards, task selection pages, or grouped links where each card
has the same visual treatment.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `moj::CARD_GROUP` from the MOJ components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::CARD_GROUP.build(obj! {
    "items": [
        obj! {
            "heading": "Search cases",
            "href": "#search",
            "description": "Find and manage case records.",
        },
        obj! {
            "heading": "Reports",
            "href": "#reports",
            "description": "View service reports.",
        },
    ],
})
```

---

## Columns

Set `columns` to control the grid width. Supported values are `2`,
`3`, and `4`.

{{slot:columns-example}}

```rust
moj::CARD_GROUP.build(obj! {
    "columns": 2,
    "items": [
        obj! {
            "heading": "People",
            "href": "#people",
            "description": "Manage people records.",
        },
        obj! {
            "heading": "Appointments",
            "href": "#appointments",
            "description": "Manage upcoming visits.",
        },
    ],
})
```

---

## Conditional cards

Use `visibleWhen` on individual items when a card depends on journey
state or user permissions.

```rust
moj::CARD_GROUP.build(obj! {
    "items": [
        obj! { "heading": "Overview", "href": "#overview" },
        obj! {
            "heading": "Restricted reports",
            "href": "#reports",
            "visibleWhen": data("canViewReports"),
        },
    ],
})
```
