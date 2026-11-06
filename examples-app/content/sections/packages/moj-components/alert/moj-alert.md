---
title: Alert
section: packages
path: packages/moj-components/alert
teaches: [moj::ALERT, alert, moj-alert]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Alert

An alert displays an important message that needs the user's
attention. The component renders the Ministry of Justice Design
System alert pattern and supports information, success, warning, and
error variants.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `moj::ALERT` from the MOJ components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::ALERT.build(obj! {
    "alertVariant": "success",
    "title": "Application submitted",
    "text": "Your changes have been saved successfully.",
    "showTitleAsHeading": true,
})
```

---

## Variants

Set `alertVariant` to choose the alert style.

{{slot:variants-example}}

```rust
moj::ALERT.build(obj! {
    "alertVariant": "information",
    "title": "Information",
    "text": "A new case note was added.",
})
moj::ALERT.build(obj! {
    "alertVariant": "success",
    "title": "Success",
    "text": "The record was updated.",
})
moj::ALERT.build(obj! {
    "alertVariant": "warning",
    "title": "Warning",
    "text": "This person has active alerts.",
})
moj::ALERT.build(obj! {
    "alertVariant": "error",
    "title": "Error",
    "text": "The record could not be saved.",
})
```

---

## Heading title

Use `showTitleAsHeading` when the alert title should be visible as a
heading, and choose the heading level with `headingTag`.

```rust
moj::ALERT.build(obj! {
    "alertVariant": "warning",
    "title": "Check the risk information",
    "text": "This case has changed since you last viewed it.",
    "showTitleAsHeading": true,
    "headingTag": "h3",
})
```

---

## Dismissible alerts

Set `"dismissible": true` when users can close the alert.

```rust
moj::ALERT.build(obj! {
    "alertVariant": "information",
    "title": "New message",
    "text": "You have a new message from the case team.",
    "dismissible": true,
    "dismissText": "Close",
})
```
