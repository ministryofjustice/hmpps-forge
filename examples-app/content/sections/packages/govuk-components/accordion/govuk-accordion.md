---
title: Accordion
section: packages
path: packages/govuk-components/accordion
teaches: [govuk::ACCORDION, accordion, govuk-accordion]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Accordion

A vertically stacked set of expandable sections. The component
renders the GOV.UK Design System accordion and supports summaries,
child blocks, persistent state, and conditional sections.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::ACCORDION` from the GOV.UK components package. Every
accordion needs a unique `id` and an `items` array.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::ACCORDION.build(obj! {
    "id": "writing-guide",
    "items": [
        obj! {
            "heading": obj! { "text": "Writing well for the web" },
            "content": obj! { "text": "This is the content for writing well for the web." },
        },
        obj! {
            "heading": obj! { "text": "Writing well for specialists" },
            "content": obj! { "text": "This is the content for writing for specialists." },
        },
    ],
})
```

---

## With summaries

Add a `summary` to each item to give users more context before they
expand the section.

{{slot:summary-example}}

```rust
govuk::ACCORDION.build(obj! {
    "id": "guidance-accordion",
    "items": [
        obj! {
            "heading": obj! { "text": "Understanding agile" },
            "summary": obj! { "text": "Principles, values, and best practices" },
            "content": obj! { "text": "Agile is an iterative approach to project management." },
        },
        obj! {
            "heading": obj! { "text": "Working in sprints" },
            "summary": obj! { "text": "Planning, standups, and retrospectives" },
            "content": obj! { "text": "Sprints are short, time-boxed periods of work." },
        },
    ],
})
```

---

## Expanded by default

Set `"expanded": true` on an item to render it open.

```rust
obj! {
    "heading": obj! { "text": "Important section" },
    "content": obj! { "text": "This section starts expanded." },
    "expanded": true,
}
```

---

## With child blocks

Use `content.blocks` to render Forge blocks inside a section.

```rust
obj! {
    "heading": obj! { "text": "Contact details" },
    "content": obj! {
        "blocks": [
            govuk::BODY.build(obj! { "text": "Email: support@example.com" }),
            govuk::BODY.build(obj! { "text": "Phone: 0800 123 4567" }),
        ],
    },
}
```

---

## Persistent state

By default the accordion remembers which sections the user has
expanded using session storage. Set `"rememberExpanded": false` to
disable this.

```rust
govuk::ACCORDION.build(obj! {
    "id": "faq",
    "rememberExpanded": false,
    "items": Vec::<Value>::new() /* ... */,
})
```
