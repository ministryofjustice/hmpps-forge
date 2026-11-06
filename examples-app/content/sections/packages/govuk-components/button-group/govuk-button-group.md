---
title: Button Group
section: packages
path: packages/govuk-components/button-group
teaches: [govuk::BUTTON_GROUP, button-group, govuk-button-group]
prerequisites: [govuk-components-package, block, govuk-button]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Button group

A container that arranges buttons and links in a row on desktop and
stacks them on mobile. Use it when a page has more than one action.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::BUTTON_GROUP` from the GOV.UK components package. Pass
an array of buttons or link buttons.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::BUTTON_GROUP.build(obj! {
    "buttons": [
        govuk::BUTTON.build(obj! { "text": "Save and continue" }),
        govuk::LINK_BUTTON.build(obj! {
            "text": "Cancel",
            "href": "/overview",
            "classes": "govuk-button--secondary",
        }),
    ],
})
```

---

## Primary and secondary

Pair a primary button with a secondary action.

{{slot:primary-secondary-example}}

```rust
govuk::BUTTON_GROUP.build(obj! {
    "buttons": [
        govuk::BUTTON.build(obj! { "text": "Submit" }),
        govuk::BUTTON.build(obj! { "text": "Save as draft", "classes": "govuk-button--secondary" }),
    ],
})
```

---

## With warning button

```rust
govuk::BUTTON_GROUP.build(obj! {
    "buttons": [
        govuk::BUTTON.build(obj! { "text": "Save changes" }),
        govuk::BUTTON.build(obj! { "text": "Delete", "classes": "govuk-button--warning" }),
    ],
})
```
