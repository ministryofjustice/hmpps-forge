---
title: Breadcrumbs
section: packages
path: packages/govuk-components/breadcrumbs
teaches: [govuk::BREADCRUMBS, breadcrumbs, govuk-breadcrumbs]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Breadcrumbs

A navigation trail showing the user's location within the site
hierarchy. The component renders the GOV.UK Design System
breadcrumbs.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::BREADCRUMBS` from the GOV.UK components package. Each
item has `text` and an optional `href`. The last item is typically
the current page and has no link.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::BREADCRUMBS.build(obj! {
    "items": [
        obj! { "text": "Home", "href": "/" },
        obj! { "text": "Cases", "href": "/cases" },
        obj! { "text": "Case details" },
    ],
})
```

---

## Collapse on mobile

Set `"collapseOnMobile": true` to show only the first and last items
on small screens, saving vertical space.

{{slot:collapsed-example}}

```rust
govuk::BREADCRUMBS.build(obj! {
    "collapseOnMobile": true,
    "items": [
        obj! { "text": "Home", "href": "/" },
        obj! { "text": "Cases", "href": "/cases" },
        obj! { "text": "Active cases", "href": "/cases/active" },
        obj! { "text": "Case details" },
    ],
})
```

---

## Dynamic items

Use expressions for dynamic breadcrumb trails.

```rust
govuk::BREADCRUMBS.build(obj! {
    "items": [
        obj! { "text": "Home", "href": "/" },
        obj! { "text": "Cases", "href": "/cases" },
        obj! { "text": data("caseName") },
    ],
})
```
