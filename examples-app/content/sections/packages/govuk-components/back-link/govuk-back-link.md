---
title: Back Link
section: packages
path: packages/govuk-components/back-link
teaches: [govuk::BACK_LINK, back-link, govuk-back-link]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Back link

A link that takes the user to the previous page. The component
renders the GOV.UK Design System back link.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::BACK_LINK` from the GOV.UK components package. The
`href` property is required.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::BACK_LINK.build(obj! { "href": "/previous-page" })
```

The default text is "Back". Override it with the `text` property.

---

## Custom text

```rust
govuk::BACK_LINK.build(obj! {
    "href": "/cases",
    "text": "Back to cases",
})
```

---

## Dynamic href

Use expressions for dynamic back links.

```rust
govuk::BACK_LINK.build(obj! {
    "href": format("/cases/%1", [params("caseId").into()]),
    "text": "Back to case",
})
```
