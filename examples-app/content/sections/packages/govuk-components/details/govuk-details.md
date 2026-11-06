---
title: Details
section: packages
path: packages/govuk-components/details
teaches: [govuk::DETAILS, details, govuk-details]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Details

An expandable disclosure component that lets users reveal additional
content. The component renders the GOV.UK Design System details
element and supports plain text, HTML, and child blocks as content.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::DETAILS` from the GOV.UK components package. Every
details component needs a clickable label - `summaryText`, or
`summaryHtml` for markup - and content to reveal.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::DETAILS.build(obj! {
    "summaryText": "Help with nationality",
    "text": "If you are not sure about your nationality, try to find out from an official document such as a passport or national ID card.",
})
```

---

## Content types

### Plain text

```rust
govuk::DETAILS.build(obj! {
    "summaryText": "What happens next",
    "text": "We will review your application and contact you within 5 working days.",
})
```

### HTML content

Use `core_blocks::HTML` when you need formatting, links, or other markup.

{{slot:html-example}}

```rust
govuk::DETAILS.build(obj! {
    "summaryText": "Where to find your reference number",
    "html": "Your reference number is on the letter we sent you. It starts with <strong>HDJ</strong> followed by 4 numbers and a letter.",
})
```

### Child blocks

Use `content` to render other Forge blocks inside the expandable
section.

```rust
govuk::DETAILS.build(obj! {
    "summaryText": "View contact details",
    "content": [
        govuk::BODY.build(obj! { "text": "Email: support@example.com" }),
        govuk::BODY.build(obj! { "text": "Phone: 0800 123 4567" }),
    ],
})
```

---

## Open by default

Set `"open": true` to render the component in its expanded state.

```rust
govuk::DETAILS.build(obj! {
    "summaryText": "Important information",
    "text": "This section contains details you should read before continuing.",
    "open": true,
})
```
