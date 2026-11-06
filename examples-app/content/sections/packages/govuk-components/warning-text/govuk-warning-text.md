---
title: Warning Text
section: packages
path: packages/govuk-components/warning-text
teaches: [govuk::WARNING_TEXT, warning-text, govuk-warning-text]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Warning text

A prominent warning message with an exclamation mark icon. Use it for
important information that the user needs to be aware of, such as
legal consequences or irreversible actions. The component renders the
GOV.UK Design System warning text pattern.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::WARNING_TEXT` from the GOV.UK components package. Provide
either `text` or `core_blocks::HTML` as content.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::WARNING_TEXT.build(obj! {
    "text": "You can be fined up to £5,000 if you do not register.",
})
```

---

## HTML content

Use `core_blocks::HTML` when you need links or formatting within the warning.

{{slot:html-example}}

```rust
govuk::WARNING_TEXT.build(obj! {
    "html": "You must <a class=\"govuk-link\" href=\"/complete\">complete your return</a> by 31 January.",
})
```

---

## Screen reader text

The component includes a visually hidden "Warning" prefix for screen
readers. Override it with `iconFallbackText` if you need different
wording.

```rust
govuk::WARNING_TEXT.build(obj! {
    "text": "This action cannot be undone.",
    "iconFallbackText": "Important",
})
```

---

## Conditional visibility

Show the warning only when a condition is met.

```rust
govuk::WARNING_TEXT.build(obj! {
    "text": "Your session will expire in 5 minutes.",
    "visibleWhen": data("sessionExpiringSoon").matches(condition::equals(true)),
})
```
