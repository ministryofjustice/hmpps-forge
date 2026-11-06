---
title: Badge
section: packages
path: packages/moj-components/badge
teaches: [moj::BADGE, badge, moj-badge]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Badge

A small coloured label used to show status or category information.
The component renders the Ministry of Justice Design System badge
pattern and supports the standard MOJ badge colour classes.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `moj::BADGE` from the MOJ components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::BADGE.build(obj! { "text": "Complete", "classes": "moj-badge--green" })
```

---

## Colours

Use `moj-badge--{colour}` classes to match the meaning of the status.

{{slot:colours-example}}

```rust
moj::BADGE.build(obj! { "text": "Urgent", "classes": "moj-badge--red" })
moj::BADGE.build(obj! { "text": "In review", "classes": "moj-badge--blue" })
moj::BADGE.build(obj! { "text": "Complete", "classes": "moj-badge--green" })
moj::BADGE.build(obj! { "text": "Paused", "classes": "moj-badge--dark-grey" })
```

---

## Accessible labels

Use `label` when the badge text is short and needs more context for
screen readers.

```rust
moj::BADGE.build(obj! {
    "text": "High",
    "classes": "moj-badge--red",
    "label": "Risk level: High",
})
```

---

## Dynamic status

Use expressions when the badge text or colour depends on journey data.

```rust
moj::BADGE.build(obj! {
    "text": data("caseStatus.label"),
    "classes": data("caseStatus.badgeClass"),
    "label": data("caseStatus.accessibleLabel"),
})
```
