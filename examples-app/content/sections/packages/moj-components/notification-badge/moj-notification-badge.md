---
title: Notification Badge
section: packages
path: packages/moj-components/notification-badge
teaches: [moj::NOTIFICATION_BADGE, notification-badge, moj-notification-badge]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Notification badge

Displays a count of new or unread items. Zero counts are hidden by MOJ Frontend.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::NOTIFICATION_BADGE.build(obj! {
    "text": 5,
    "visuallyHiddenText": "unread messages",
})
```

---

## Large counts

{{slot:options-example}}

```rust
moj::NOTIFICATION_BADGE.build(obj! {
    "text": 120,
    "visuallyHiddenText": "unread case updates",
    "classes": "govuk-!-margin-left-2",
})
```

MOJ Frontend hides the badge when the count is zero or negative. Counts of 99 or more display as `99+`, with an accessible description of “99 or more”. Set `visuallyHiddenText` to describe what the count means.

---

## Reactive values

Use Forge expressions for properties supplied by loaded data.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::NOTIFICATION_BADGE.build(obj! {
    "text": data("unreadMessageCount"),
    "visuallyHiddenText": "unread messages",
})
```

---

## Options

| Property | Purpose |
| --- | --- |
| `text` | Required count, as a number or numeric string. |
| `visuallyHiddenText` | Description announced after the count. |
| `classes, attributes` | Additional styling and HTML attributes. |

See the [MOJ Notification Badge guidance](https://design-patterns.service.justice.gov.uk/components/notification-badge/) for usage and accessibility advice.
