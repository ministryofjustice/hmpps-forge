---
title: Progress Bar
section: packages
path: packages/moj-components/progress-bar
teaches: [moj::PROGRESS_BAR, progress-bar, moj-progress-bar, visibleWhen]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Progress bar

A progress bar shows where the user is in a linear multi-step
process. It marks completed steps, the current active step, and
upcoming steps.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `moj::PROGRESS_BAR` from the MOJ components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::PROGRESS_BAR.build(obj! {
    "label": "Application progress",
    "items": [
        obj! { "label": "Personal details", "complete": true },
        obj! { "label": "Contact information", "active": true },
        obj! { "label": "Review and submit" },
    ],
})
```

---

## Active and complete steps

Set `"complete": true` for finished steps and `"active": true` for the
current step. Only one step should normally be active.

{{slot:long-example}}

```rust
moj::PROGRESS_BAR.build(obj! {
    "label": "Visit booking progress",
    "items": [
        obj! { "label": "Choose prisoner", "complete": true },
        obj! { "label": "Choose date", "complete": true },
        obj! { "label": "Visitor details", "active": true },
        obj! { "label": "Check answers" },
    ],
})
```

---

## Custom labels

Use label objects when an item needs custom classes.

```rust
moj::PROGRESS_BAR.build(obj! {
    "label": "Case review progress",
    "items": [
        obj! {
            "label": obj! { "text": "Prepare", "classes": "govuk-!-font-weight-bold" },
            "complete": true,
        },
        obj! { "label": "Review", "active": true },
        obj! { "label": "Submit" },
    ],
})
```

---

## Conditional steps

Use `visibleWhen` on an item to omit steps that do not apply to the
current journey.

```rust
moj::PROGRESS_BAR.build(obj! {
    "label": "Application progress",
    "items": [
        obj! { "label": "Personal details", "complete": true },
        obj! {
            "label": "Security review",
            "active": true,
            "visibleWhen": data("requiresSecurityReview"),
        },
        obj! { "label": "Review and submit" },
    ],
})
```
