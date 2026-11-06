---
title: Banner
section: packages
path: packages/moj-components/banner
teaches: [moj::BANNER, banner, moj-banner]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Banner

A banner that displays important service messages. The component
renders the Ministry of Justice Design System banner pattern and
supports success, warning, and information variants.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `moj::BANNER` from the MOJ components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::BANNER.build(obj! {
    "bannerType": "success",
    "text": "Your application has been submitted.",
})
```

---

## Banner types

Set `bannerType` to choose the visual style and icon.

{{slot:types-example}}

```rust
moj::BANNER.build(obj! { "bannerType": "success", "text": "Visit request approved." })
moj::BANNER.build(obj! { "bannerType": "warning", "text": "This person has alerts on NOMIS." })
moj::BANNER.build(obj! { "bannerType": "information", "text": "A case note was added today." })
```

---

## HTML content

Use `core_blocks::HTML` when the message needs links or inline formatting.

```rust
moj::BANNER.build(obj! {
    "bannerType": "information",
    "html": "Review the <a href=\"#\" class=\"govuk-link\">case history</a> before continuing.",
})
```

---

## Dynamic content

Use expressions when the banner content depends on loaded data or user
answers.

```rust
moj::BANNER.build(obj! {
    "bannerType": data("banner.type"),
    "text": data("banner.message"),
})
```
