---
title: Timeline
section: packages
path: packages/moj-components/timeline
teaches: [moj::TIMELINE, timeline, moj-timeline]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Timeline

A timeline displays a chronological history of events. It is useful
for case history, decisions, messages, and other records where users
need to understand what happened and when.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `moj::TIMELINE` from the MOJ components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::TIMELINE.build(obj! {
    "items": [
        obj! {
            "label": obj! { "text": "Application approved" },
            "text": "The visit request was approved.",
            "datetime": obj! { "timestamp": "2026-04-24T14:30:00.000Z", "type": "datetime" },
            "byline": obj! { "text": "Caseworker 1" },
        },
    ],
})
```

---

## Multiple events

Items are displayed in the order you provide, usually with the most
recent event first.

{{slot:events-example}}

```rust
moj::TIMELINE.build(obj! {
    "headingLevel": 3,
    "items": [
        obj! {
            "label": obj! { "text": "Application approved" },
            "text": "The visit request was approved.",
            "datetime": obj! { "timestamp": "2026-04-24T14:30:00.000Z", "type": "datetime" },
            "byline": obj! { "text": "Caseworker 1" },
        },
        obj! {
            "label": obj! { "text": "Application submitted" },
            "html": "<p>The visitor submitted the request online.</p>",
            "datetime": obj! { "timestamp": "2026-04-23T09:15:00.000Z", "type": "datetime" },
            "byline": obj! { "text": "Visitor" },
        },
    ],
})
```

---

## Conditional events

Use `visibleWhen` when an event should only appear for some users or
journey states.

```rust
moj::TIMELINE.build(obj! {
    "items": [
        obj! {
            "label": obj! { "text": "Security check completed" },
            "text": "The security check passed.",
            "visibleWhen": data("securityCheckComplete"),
        },
    ],
})
```
