---
title: Side Navigation
section: packages
path: packages/moj-components/side-navigation
teaches: [moj::SIDE_NAVIGATION, side-navigation, moj-side-navigation, visibleWhen]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Side navigation

Side navigation provides a vertical list of links. It can be a simple
flat list or grouped into sections with headings.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `moj::SIDE_NAVIGATION` from the MOJ components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::SIDE_NAVIGATION.build(obj! {
    "label": "Case navigation",
    "items": [
        obj! { "text": "Overview", "href": "#overview", "active": true },
        obj! { "text": "People", "href": "#people" },
        obj! { "text": "Timeline", "href": "#timeline" },
    ],
})
```

---

## Sections

Use `sections` when the navigation needs grouped links.

{{slot:sections-example}}

```rust
moj::SIDE_NAVIGATION.build(obj! {
    "label": "Case navigation",
    "sections": [
        obj! {
            "heading": obj! { "text": "Case", "headingLevel": 3 },
            "items": [
                obj! { "text": "Overview", "href": "#overview", "active": true },
                obj! { "text": "Timeline", "href": "#timeline" },
            ],
        },
        obj! {
            "heading": obj! { "text": "Manage", "headingLevel": 3 },
            "items": [obj! { "text": "Documents", "href": "#documents" }],
        },
    ],
})
```

---

## Active item

Set `"active": true` on the current link so users can see where they
are in the section.

---

## Conditional items and sections

Use `visibleWhen` on an item or section to omit it from rendering.

```rust
moj::SIDE_NAVIGATION.build(obj! {
    "label": "Case navigation",
    "sections": [
        obj! {
            "heading": obj! { "text": "Case" },
            "items": [
                obj! { "text": "Overview", "href": "#overview", "active": true },
                obj! {
                    "text": "Timeline",
                    "href": "#timeline",
                    "visibleWhen": data("canViewTimeline"),
                },
            ],
        },
        obj! {
            "heading": obj! { "text": "Manage" },
            "visibleWhen": session("role").matches(condition::equals("admin")),
            "items": [obj! { "text": "Documents", "href": "#documents" }],
        },
    ],
})
```
