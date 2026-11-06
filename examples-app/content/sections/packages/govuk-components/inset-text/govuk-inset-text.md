---
title: Inset Text
section: packages
path: packages/govuk-components/inset-text
teaches: [govuk::INSET_TEXT, inset-text, govuk-inset-text]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Inset text

A bordered block of text used to draw attention to important content.
The component renders the GOV.UK Design System inset text pattern
with a left border.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::INSET_TEXT` from the GOV.UK components package. Provide
either `text` or `core_blocks::HTML` as content.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::INSET_TEXT.build(obj! {
    "text": "It can take up to 8 weeks to register a lasting power of attorney if there are no mistakes in the application.",
})
```

---

## HTML content

Use `core_blocks::HTML` when you need links or formatting within the inset text.

{{slot:html-example}}

```rust
govuk::INSET_TEXT.build(obj! {
    "html": "You can <a class=\"govuk-link\" href=\"/appeal\">appeal the decision</a> if you think it is wrong.",
})
```

---

## Dynamic content

Use expressions to display content based on user answers or loaded
data.

```rust
govuk::INSET_TEXT.build(obj! {
    "text": format("Your reference number is %1. Keep this safe.", [answer("referenceNumber").into()]),
})
```

---

## Conditional visibility

Show the inset text only when a condition is met.

```rust
govuk::INSET_TEXT.build(obj! {
    "text": "You have read-only access to this record.",
    "visibleWhen": data("isReadOnly").matches(condition::equals(true)),
})
```
