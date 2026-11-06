---
title: List
section: packages
path: packages/govuk-components/list
teaches: [govuk::LIST, list, govuk-list]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# List

A list of items rendered as a bullet list, numbered list, or plain
list. The component renders GOV.UK Design System list styles and
supports dynamic items from data.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::LIST` from the GOV.UK components package. The `items`
property accepts an array of strings or child blocks, or a data source
that resolves to one.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::LIST.build(obj! {
    "items": ["First item", "Second item", "Third item"],
    "style": "bullet",
})
```

---

## List types

### Bullet list

{{slot:bullet-example}}

```rust
govuk::LIST.build(obj! {
    "items": ["Design", "Build", "Test"],
    "style": "bullet",
})
```

### Numbered list

{{slot:numbered-example}}

```rust
govuk::LIST.build(obj! {
    "items": ["Check eligibility", "Gather documents", "Submit application"],
    "style": "number",
})
```

### Plain list

Omit `style` for a plain list with no markers.

```rust
govuk::LIST.build(obj! {
    "items": ["support@example.com", "0800 123 4567"],
})
```

---

## Spaced list

Set `"spaced": true` to add extra vertical spacing between items.

```rust
govuk::LIST.build(obj! {
    "items": ["First item", "Second item", "Third item"],
    "style": "bullet",
    "spaced": true,
})
```

---

## Block items

Items can be child blocks instead of strings - or a mix of the two. Each block renders
inside its own `<li>`.

{{slot:block-items-example}}

```rust
govuk::LIST.build(obj! {
    "items": [
        Value::from("A plain string item"),
        govuk::BODY.build(obj! { "text": "A paragraph item" }),
        core_blocks::HTML.build(obj! {
            "tag": "a",
            "attributes": obj! { "href": "/help" },
            "content": "A link item",
        }),
    ],
    "style": "bullet",
})
```

---

## Dynamic items

Use `data()` to render items from loaded data.

```rust
govuk::LIST.build(obj! {
    "items": data("errorMessages"),
    "style": "bullet",
})
```
