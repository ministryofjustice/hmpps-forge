---
title: Multi Select
section: packages
path: packages/moj-components/multi-select
teaches: [moj::MULTI_SELECT, multi-select, moj-multi-select]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Multi select

A multi-select table lets users select multiple rows. It renders a
GOV.UK table with the MOJ multi-select JavaScript enhancement enabled.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `moj::MULTI_SELECT` from the MOJ components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::MULTI_SELECT.build(obj! {
    "head": [
        obj! {
            "html": "<input type=\"checkbox\" class=\"govuk-checkboxes__input\" id=\"select-all\">",
        },
        obj! { "text": "Name" },
        obj! { "text": "Status" },
    ],
    "rows": [
        [
            obj! {
                "html": "<input type=\"checkbox\" class=\"govuk-checkboxes__input\" name=\"selected\" value=\"1\">",
            },
            obj! { "text": "John Smith" },
            obj! { "text": "Active" },
        ],
    ],
})
```

---

## Table caption

Use a caption to describe what the selectable rows represent.

{{slot:caption-example}}

```rust
moj::MULTI_SELECT.build(obj! {
    "caption": "People to allocate",
    "captionClasses": "govuk-table__caption--m",
    "head": [
        obj! {
            "html": "<input type=\"checkbox\" class=\"govuk-checkboxes__input\" id=\"select-people\">",
        },
        obj! { "text": "Name" },
        obj! { "text": "Status" },
    ],
    "rows": [
        [
            obj! {
                "html": "<input type=\"checkbox\" class=\"govuk-checkboxes__input\" name=\"people\" value=\"1\">",
            },
            obj! { "text": "John Smith" },
            obj! { "text": "Active" },
        ],
    ],
})
```

---

## Checkbox cells

The first column should contain checkbox inputs. The header checkbox is
used by the JavaScript enhancement to select or deselect all rows.
