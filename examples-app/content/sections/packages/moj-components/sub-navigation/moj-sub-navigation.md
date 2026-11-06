---
title: Sub Navigation
section: packages
path: packages/moj-components/sub-navigation
teaches: [moj::SUB_NAVIGATION, sub-navigation, moj-sub-navigation, visibleWhen]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Sub navigation

Sub navigation lets users move between secondary sections within a
service area. Use it below the main navigation, not as a replacement
for global navigation.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `moj::SUB_NAVIGATION` from the MOJ components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::SUB_NAVIGATION.build(obj! {
    "label": "Case sections",
    "items": [
        obj! { "text": "Overview", "href": "#overview", "active": true },
        obj! { "text": "Documents", "href": "#documents" },
        obj! { "text": "Timeline", "href": "#timeline" },
    ],
})
```

---

## Active item

Set `"active": true` on the current item. The component adds the
appropriate current-page state.

{{slot:items-example}}

```rust
moj::SUB_NAVIGATION.build(obj! {
    "label": "Case sections",
    "items": [
        obj! { "text": "Overview", "href": "#overview" },
        obj! { "text": "Documents", "href": "#documents", "active": true },
        obj! { "text": "Timeline", "href": "#timeline" },
    ],
})
```

---

## Conditional items

Use `visibleWhen` on an item to omit it from rendering.

```rust
moj::SUB_NAVIGATION.build(obj! {
    "label": "Case sections",
    "items": [
        obj! { "text": "Overview", "href": "#overview", "active": true },
        obj! {
            "text": "Documents",
            "href": "#documents",
            "visibleWhen": data("canViewDocuments"),
        },
        obj! { "text": "Timeline", "href": "#timeline" },
    ],
})
```

---

## HTML labels

Use `core_blocks::HTML` when an item label needs inline markup.

```rust
moj::SUB_NAVIGATION.build(obj! {
    "items": [
        obj! {
            "html": "Messages <span class=\"govuk-visually-hidden\">about this case</span>",
            "href": "#messages",
        },
    ],
})
```
