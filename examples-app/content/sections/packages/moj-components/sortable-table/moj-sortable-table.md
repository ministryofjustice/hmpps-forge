---
title: Sortable Table
section: packages
path: packages/moj-components/sortable-table
teaches: [moj::SORTABLE_TABLE, sortable-table, moj-sortable-table]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Sortable table

A sortable table renders a GOV.UK table with the MOJ sortable table
JavaScript enhancement enabled. Users can sort rows by clicking column
headers.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `moj::SORTABLE_TABLE` from the MOJ components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::SORTABLE_TABLE.build(obj! {
    "head": [
        obj! { "html": "<button>Name</button>" },
        obj! { "html": "<button>Date</button>" },
        obj! { "html": "<button>Status</button>" },
    ],
    "rows": [
        [obj! { "text": "John Smith" }, obj! { "text": "2026-04-24" }, obj! { "text": "Active" }],
        [obj! { "text": "Jane Doe" }, obj! { "text": "2026-04-25" }, obj! { "text": "Pending" }],
    ],
})
```

---

## Captions

Use `caption` and `captionClasses` to describe the table.

{{slot:caption-example}}

```rust
moj::SORTABLE_TABLE.build(obj! {
    "caption": "Appointments",
    "captionClasses": "govuk-table__caption--m",
    "head": [
        obj! { "html": "<button>Name</button>" },
        obj! { "html": "<button>Date</button>" },
        obj! { "html": "<button>Status</button>" },
    ],
    "rows": [
        [obj! { "text": "John Smith" }, obj! { "text": "2026-04-24" }, obj! { "text": "Active" }],
    ],
})
```

---

## Header buttons

Header cells should contain button elements so the JavaScript
enhancement can make each sortable column keyboard accessible.
