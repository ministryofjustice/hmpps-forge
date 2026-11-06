---
title: Tabs
section: packages
path: packages/govuk-components/tabs
teaches: [govuk::TABS, tabs, govuk-tabs, visibleWhen]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Tabs

A set of tabbed content panels that lets users switch between
related sections of content. The component renders the GOV.UK Design
System tabs pattern.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::TABS` from the GOV.UK components package. Every tab
group needs a unique `id` and an `items` array. Each item has an
`id`, a `label` (the tab text), and `panel` content.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::TABS.build(obj! {
    "id": "cases",
    "items": [
        obj! {
            "id": "active",
            "label": "Active",
            "panel": obj! { "text": "These are your active cases." },
        },
        obj! {
            "id": "closed",
            "label": "Closed",
            "panel": obj! { "text": "These are your closed cases." },
        },
    ],
})
```

---

## HTML content

Use `panel.html` for rich content inside a tab.

{{slot:html-example}}

```rust
govuk::TABS.build(obj! {
    "id": "schedule",
    "items": [
        obj! {
            "id": "monday",
            "label": "Monday",
            "panel": obj! {
                "html": "<h2 class=\"govuk-heading-m\">Monday</h2><p class=\"govuk-body\">9am to 5pm</p>",
            },
        },
        obj! {
            "id": "tuesday",
            "label": "Tuesday",
            "panel": obj! {
                "html": "<h2 class=\"govuk-heading-m\">Tuesday</h2><p class=\"govuk-body\">10am to 4pm</p>",
            },
        },
        obj! {
            "id": "wednesday",
            "label": "Wednesday",
            "panel": obj! {
                "html": "<h2 class=\"govuk-heading-m\">Wednesday</h2><p class=\"govuk-body\">9am to 5pm</p>",
            },
        },
    ],
})
```

---

## With child blocks

Use `panel.blocks` to render Forge blocks inside a tab panel.

```rust
obj! {
    "id": "summary",
    "label": "Summary",
    "panel": obj! {
        "blocks": [
            govuk::HEADING.build(obj! { "text": "Case summary", "size": "m" }),
            govuk::BODY.build(obj! { "text": "This case was opened on 15 March 2024." }),
        ],
    },
}
```

---

## Conditional tabs

Use `visibleWhen` on a tab item to omit the tab and its panel from
rendering.

```rust
govuk::TABS.build(obj! {
    "id": "case-tabs",
    "items": [
        obj! {
            "id": "overview",
            "label": "Overview",
            "panel": obj! { "text": "Case overview" },
        },
        obj! {
            "id": "admin",
            "label": "Admin",
            "panel": obj! { "text": "Admin-only details" },
            "visibleWhen": session("role").matches(condition::equals("admin")),
        },
    ],
})
```

---

## Custom title

The default title is "Contents". Override it with the `title`
property.

```rust
govuk::TABS.build(obj! {
    "id": "schedule",
    "title": "Schedule",
    "items": Vec::<Value>::new() /* ... */,
})
```
