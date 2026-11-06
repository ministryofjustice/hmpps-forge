---
title: Identity Bar
section: packages
path: packages/moj-components/identity-bar
teaches: [moj::IDENTITY_BAR, identity-bar, moj-identity-bar]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Identity bar

Shows the identity of the current case or person with related action menus.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::IDENTITY_BAR.build(obj! {
    "title": "Alex Smith",
    "menus": [obj! { "items": [obj! { "text": "Edit details", "href": "#edit-details" }] }],
})
```

---

## Grouped actions

{{slot:options-example}}

```rust
moj::IDENTITY_BAR.build(obj! {
    "title": obj! { "html": "<strong>Alex Smith</strong> — Case ABC123" },
    "menus": [
        obj! {
            "button": obj! { "text": "Case actions" },
            "items": [
                obj! { "text": "View history", "href": "#history" },
                obj! {
                    "text": "Restricted action",
                    "href": "#restricted",
                    "visibleWhen": false,
                },
            ],
        },
    ],
})
```

Titles accept plain strings or text/HTML objects. Each menu uses the existing MOJ Button menu options. Both menus and their items support `visibleWhen`; hidden menus and actions are removed before rendering.

---

## Reactive values

Use Forge expressions for properties supplied by loaded data.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::IDENTITY_BAR.build(obj! {
    "title": data("caseName"),
    "menus": [
        obj! {
            "visibleWhen": data("canEditCase"),
            "items": [obj! { "text": "Edit details", "href": "/case/edit" }],
        },
    ],
})
```

---

## Options

| Property | Purpose |
| --- | --- |
| `title` | Identity text or an object containing text or html. |
| `menus` | Action menus with button, alignMenu, items, classes, attributes, and visibleWhen. |
| `classes, attributes` | Additional styling and HTML attributes. |

See the [MOJ Identity Bar guidance](https://design-patterns.service.justice.gov.uk/components/identity-bar/) for usage and accessibility advice.
