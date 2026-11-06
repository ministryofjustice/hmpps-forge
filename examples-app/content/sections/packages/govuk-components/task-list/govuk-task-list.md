---
title: Task List
section: packages
path: packages/govuk-components/task-list
teaches: [govuk::TASK_LIST, task-list, govuk-task-list]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Task list

A list of tasks with status indicators. The component renders the
GOV.UK Design System task list and supports links, hints, status
tags, and conditional visibility.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::TASK_LIST` from the GOV.UK components package. Each
item has a `title` and a `status`.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::TASK_LIST.build(obj! {
    "items": [
        obj! {
            "title": obj! { "text": "Personal details" },
            "status": obj! { "text": "Completed" },
        },
        obj! {
            "title": obj! { "text": "Contact information" },
            "status": obj! { "text": "In progress" },
        },
        obj! {
            "title": obj! { "text": "Upload documents" },
            "status": obj! { "text": "Not yet started" },
        },
    ],
})
```

---

## Linked tasks

Add `href` to make a task title a clickable link.

{{slot:linked-example}}

```rust
govuk::TASK_LIST.build(obj! {
    "items": [
        obj! {
            "title": obj! { "text": "Personal details" },
            "href": "/personal-details",
            "status": obj! { "tag": obj! { "text": "Completed", "classes": "govuk-tag--blue" } },
        },
        obj! {
            "title": obj! { "text": "Contact information" },
            "href": "/contact",
            "status": obj! { "tag": obj! { "text": "Incomplete", "classes": "govuk-tag--grey" } },
        },
    ],
})
```

---

## Status tags

Use `status.tag` instead of `status.text` to render a coloured tag.

```rust
"status": obj! {
    "tag": obj! {
        "text": "Completed",
        "classes": "govuk-tag--green",
    },
},
```

---

## Hints

Add hints below the task title for additional context.

```rust
obj! {
    "title": obj! { "text": "Your details" },
    "hint": obj! { "text": "Your name and relationship to the prisoner" },
    "href": "/your-details",
    "status": obj! { "tag": obj! { "text": "Not started", "classes": "govuk-tag--grey" } },
}
```

---

## Conditional tasks

Use `visibleWhen` to show tasks only when prerequisites are met.

```rust
obj! {
    "title": obj! { "text": "Submit application" },
    "visibleWhen": and(vec![data("personalDetailsComplete").matches(condition::equals(true)), data("contactComplete").matches(condition::equals(true))]),
    "status": obj! { "text": "Cannot start yet" },
}
```
