---
title: Body
section: packages
path: packages/govuk-components/body
teaches: [govuk::BODY, body, govuk-body]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Body

A paragraph of body text. The component renders a `<p>` element
with GOV.UK Design System typography classes and supports size
variants and dynamic content.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::BODY` from the GOV.UK components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::BODY.build(obj! { "text": "This is a paragraph of body text." })
```

---

## Size variants

Use the `size` property to change the text size.

{{slot:sizes-example}}

```rust
govuk::BODY.build(obj! { "text": "Lead paragraph text at 24px.", "size": "l" })
govuk::BODY.build(obj! { "text": "Default body text at 19px." })
govuk::BODY.build(obj! { "text": "Small body text at 16px.", "size": "s" })
```

---

## Dynamic content

Use expressions for text that depends on user answers or loaded
data.

```rust
govuk::BODY.build(obj! {
    "text": format("Your reference number is %1.", [answer("referenceNumber").into()]),
})
```
