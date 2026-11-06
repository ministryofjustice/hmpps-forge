---
title: Card
section: packages
path: packages/moj-components/card
teaches: [moj::CARD, card, moj-card]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Card

A card presents a prominent link with supporting text. Use cards for
dashboard-style pages where users need to choose between several
service areas or tasks.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `moj::CARD` from the MOJ components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::CARD.build(obj! {
    "heading": "Search cases",
    "href": "#search-cases",
    "description": "Find and manage case records.",
})
```

---

## Heading options

Use a heading object when you need to control the heading level or
classes.

{{slot:heading-example}}

```rust
moj::CARD.build(obj! {
    "heading": obj! { "text": "Manage appointments", "level": 3 },
    "href": "#appointments",
    "description": "Create, update, and cancel visits.",
})
```

---

## HTML descriptions

Use `description.html` when the supporting text needs inline markup.

```rust
moj::CARD.build(obj! {
    "heading": "Risk information",
    "href": "#risk",
    "description": obj! {
        "html": "Review <strong>active alerts</strong> before continuing.",
    },
})
```
