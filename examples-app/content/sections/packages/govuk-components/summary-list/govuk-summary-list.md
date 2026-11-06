---
title: Summary List
section: packages
path: packages/govuk-components/summary-list
teaches: [govuk::SUMMARY_LIST, summary-list, govuk-summary-list]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Summary list

A list of key-value pairs used to display information. The component
renders the GOV.UK Design System summary list and supports action
links, conditional rows, summary cards, and dynamic content.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::SUMMARY_LIST` from the GOV.UK components package. Each
row has a `key` and a `value`, and optionally an `actions` list.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::SUMMARY_LIST.build(obj! {
    "rows": [
        obj! {
            "key": obj! { "text": "Name" },
            "value": obj! { "text": "Sarah Philips" },
        },
        obj! {
            "key": obj! { "text": "Date of birth" },
            "value": obj! { "text": "5 January 1978" },
        },
        obj! {
            "key": obj! { "text": "Address" },
            "value": obj! { "text": "72 Guild Street, London, SE23 6FH" },
        },
    ],
})
```

---

## Action links

Add a `Change` or other action link to each row. Use
`visuallyHiddenText` to make the link accessible - screen readers
will announce "Change name" rather than just "Change".

{{slot:actions-example}}

```rust
govuk::SUMMARY_LIST.build(obj! {
    "rows": [
        obj! {
            "key": obj! { "text": "Name" },
            "value": obj! { "text": "Sarah Philips" },
            "actions": obj! {
                "items": [
                    obj! { "href": "/change-name", "text": "Change", "visuallyHiddenText": "name" },
                ],
            },
        },
        obj! {
            "key": obj! { "text": "Date of birth" },
            "value": obj! { "text": "5 January 1978" },
            "actions": obj! {
                "items": [
                    obj! {
                        "href": "/change-dob",
                        "text": "Change",
                        "visuallyHiddenText": "date of birth",
                    },
                ],
            },
        },
    ],
})
```

---

## Summary card

Wrap the summary list in a card with a title and optional header
actions using the `card` property.

{{slot:card-example}}

```rust
govuk::SUMMARY_LIST.build(obj! {
    "card": obj! {
        "title": obj! { "text": "Personal details" },
        "actions": obj! {
            "items": [
                obj! {
                    "href": "/delete",
                    "text": "Delete",
                    "classes": "govuk-link--destructive",
                },
            ],
        },
    },
    "rows": [
        obj! {
            "key": obj! { "text": "Name" },
            "value": obj! { "text": "Sarah Philips" },
        },
        obj! {
            "key": obj! { "text": "Email" },
            "value": obj! { "text": "sarah@example.com" },
        },
    ],
})
```

---

## Dynamic values

Use `answer()`, `data()`, or other expressions for dynamic content.

```rust
govuk::SUMMARY_LIST.build(obj! {
    "rows": [
        obj! {
            "key": obj! { "text": "Full name" },
            "value": obj! { "text": answer("fullName") },
        },
        obj! {
            "key": obj! { "text": "Email" },
            "value": obj! { "text": answer("email") },
        },
        obj! {
            "key": obj! { "text": "Date of birth" },
            "value": obj! {
                "text": answer("dateOfBirth").pipe([transformer::string::to_date(), transformer::date::format("D MMMM YYYY")]),
            },
        },
    ],
})
```

---

## Conditional rows

Use `visibleWhen` on a row to show it only when a condition is met.

```rust
obj! {
    "key": obj! { "text": "Phone number" },
    "value": obj! { "text": answer("phone") },
    "visibleWhen": answer("contactMethod").matches(condition::equals("phone")),
}
```
