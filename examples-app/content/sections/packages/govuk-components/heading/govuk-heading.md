---
title: Heading
section: packages
path: packages/govuk-components/heading
teaches: [govuk::HEADING, heading, govuk-heading]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Heading

A heading element with GOV.UK Design System typography. The
component supports visual size variants, configurable heading
levels, captions, and dynamic content.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::HEADING` from the GOV.UK components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::HEADING.build(obj! { "text": "Page title" })
```

---

## Size

The `size` property controls the visual size. The heading level
defaults based on size but can be overridden with `level`.

{{slot:sizes-example}}

```rust
govuk::HEADING.build(obj! { "text": "Extra large heading", "size": "xl" })
govuk::HEADING.build(obj! { "text": "Large heading", "size": "l" })
govuk::HEADING.build(obj! { "text": "Medium heading", "size": "m" })
govuk::HEADING.build(obj! { "text": "Small heading", "size": "s" })
```

| Size | Font size | Default level |
|---|---|---|
| `"xl"` | 48px | `<h1>` |
| `"l"` | 36px | `<h1>` |
| `"m"` | 24px | `<h2>` |
| `"s"` | 19px bold | `<h3>` |

---

## Caption

Add a caption above the heading for context.

{{slot:caption-example}}

```rust
govuk::HEADING.build(obj! {
    "text": "Personal details",
    "size": "l",
    "caption": "Section 1 of 4",
})
```

---

## Custom level

Override the default heading level when the visual size does not
match the document hierarchy.

```rust
govuk::HEADING.build(obj! { "text": "Section title", "size": "l", "level": 2 })
```

---

## Dynamic content

```rust
govuk::HEADING.build(obj! { "text": data("caseName"), "size": "l" })
```
