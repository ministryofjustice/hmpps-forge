---
title: Messages
section: packages
path: packages/moj-components/messages
teaches: [moj::MESSAGES, messages, moj-messages, visibleWhen]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Messages

Messages display a conversation thread with sent and received
messages. Each message includes content, sender information, and a
timestamp.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `moj::MESSAGES` from the MOJ components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::MESSAGES.build(obj! {
    "label": "Case correspondence",
    "items": [
        obj! {
            "id": 1,
            "text": "Can you confirm the visit time?",
            "type": "sent",
            "sender": "Caseworker",
            "timestamp": "2026-04-24T10:00:00.000Z",
        },
    ],
})
```

---

## Sent and received messages

Use `"type": "sent"` for outgoing messages and `"type": "received"` for
incoming messages.

{{slot:thread-example}}

```rust
moj::MESSAGES.build(obj! {
    "label": "Case correspondence",
    "items": [
        obj! {
            "id": 1,
            "text": "Can you confirm the visit time?",
            "type": "sent",
            "sender": "Caseworker",
            "timestamp": "2026-04-24T10:00:00.000Z",
        },
        obj! {
            "id": 2,
            "text": "The visitor confirmed 2pm.",
            "type": "received",
            "sender": "Visits team",
            "timestamp": "2026-04-24T10:15:00.000Z",
        },
    ],
})
```

---

## HTML content

Use `core_blocks::HTML` when a message needs links or inline formatting.

```rust
moj::MESSAGES.build(obj! {
    "items": [
        obj! {
            "html": "<p>See the <a href=\"#\">updated risk assessment</a>.</p>",
            "type": "received",
            "sender": "Risk team",
            "timestamp": "2026-04-24T11:00:00.000Z",
        },
    ],
})
```

---

## Conditional messages

Use `visibleWhen` on an item to omit a message from rendering.

```rust
moj::MESSAGES.build(obj! {
    "label": "Case correspondence",
    "items": [
        obj! {
            "text": "The visitor confirmed 2pm.",
            "type": "received",
            "sender": "Visits team",
            "timestamp": "2026-04-24T10:15:00.000Z",
        },
        obj! {
            "text": "Internal note: security review complete.",
            "type": "received",
            "sender": "Security team",
            "timestamp": "2026-04-24T10:30:00.000Z",
            "visibleWhen": session("role").matches(condition::equals("admin")),
        },
    ],
})
```
