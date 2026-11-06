---
title: Interruption Card
section: packages
path: packages/moj-components/interruption-card
teaches: [moj::INTERRUPTION_CARD, interruption-card, moj-interruption-card]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Interruption card

Pauses a journey with important information and actions.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::INTERRUPTION_CARD.build(obj! {
    "heading": "Before you continue",
    "text": "Check that the case details are correct before sending your request.",
    "primaryAction": obj! { "text": "Continue", "href": "#continue" },
    "secondaryAction": obj! { "text": "Go back", "href": "#back" },
})
```

---

## Content and action styles

{{slot:options-example}}

```rust
moj::INTERRUPTION_CARD.build(obj! {
    "heading": "Check the reference number",
    "html": "<p class=\"govuk-body\">Your case reference is <strong>ABC123</strong>.</p>",
    "primaryAction": obj! { "text": "Continue", "href": "#continue", "style": "link" },
    "secondaryAction": obj! { "text": "Go back", "href": "#back", "style": "button" },
})
```

The upstream component includes an `h1`, so use it for a dedicated interruption page. The preview is embedded here for demonstration. `text` is escaped; use trusted `core_blocks::HTML` or `blocks` for rich content. Child blocks take precedence. The primary action defaults to a button and the secondary action to a link. The wrapper supplies the Nunjucks caller required by the upstream macro.

---

## Reactive values

Use Forge expressions for properties supplied by loaded data.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::INTERRUPTION_CARD.build(obj! {
    "heading": "Check the case",
    "text": data("interruptionMessage"),
    "primaryAction": obj! { "text": "Continue", "href": "/case/confirm" },
})
```

---

## Options

| Property | Purpose |
| --- | --- |
| `heading` | Required heading. |
| `text, html, blocks` | Body content; blocks take precedence. |
| `primaryAction` | Required text, optional href, style, and button attributes. |
| `secondaryAction` | Optional secondary action with the same options. |

See the [MOJ Interruption Card guidance](https://design-patterns.service.justice.gov.uk/components/interruption-card/) for usage and accessibility advice.
