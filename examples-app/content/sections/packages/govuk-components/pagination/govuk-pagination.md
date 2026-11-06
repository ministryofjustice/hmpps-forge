---
title: Pagination
section: packages
path: packages/govuk-components/pagination
teaches: [govuk::PAGINATION, pagination, govuk-pagination, visibleWhen]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Pagination

Navigation controls for paged content. The component renders the
GOV.UK Design System pagination and supports previous/next links,
numbered page items, and ellipsis gaps.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::PAGINATION` from the GOV.UK components package. Use
`previous` and `next` for simple two-way navigation, or add `items`
for numbered pages.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::PAGINATION.build(obj! {
    "previous": obj! { "href": "?page=1" },
    "next": obj! { "href": "?page=3" },
})
```

---

## Numbered pages

Add `items` for page number links. Set `"current": true` on the
active page. Use `"ellipsis": true` for gaps in long page lists.

{{slot:numbered-example}}

```rust
govuk::PAGINATION.build(obj! {
    "previous": obj! { "href": "?page=1" },
    "next": obj! { "href": "?page=3" },
    "items": [
        obj! { "number": "1", "href": "?page=1" },
        obj! { "number": "2", "href": "?page=2", "current": true },
        obj! { "number": "3", "href": "?page=3" },
    ],
})
```

---

## With ellipsis

Use ellipsis items to indicate skipped pages in long lists.

```rust
"items": [
    obj! { "number": "1", "href": "?page=1" },
    obj! { "number": "2", "href": "?page=2", "current": true },
    obj! { "number": "3", "href": "?page=3" },
    obj! { "ellipsis": true },
    obj! { "number": "20", "href": "?page=20" },
],
```

---

## Custom link text

Override the default "Previous" and "Next" text, and add a label
for context.

```rust
govuk::PAGINATION.build(obj! {
    "previous": obj! {
        "href": "/results/1",
        "text": "Previous",
        "labelText": "1 of 3",
    },
    "next": obj! {
        "href": "/results/3",
        "text": "Next",
        "labelText": "3 of 3",
    },
})
```

---

## Conditional visibility

Hide previous, next, or numbered links when they should not be shown.

```rust
govuk::PAGINATION.build(obj! {
    "previous": obj! {
        "href": format("?page=%1", [data("currentPage").pipe([transformer::number::add(-1)]).into()]),
        "visibleWhen": data("currentPage").matches(condition::number::greater_than(1)),
    },
    "next": obj! {
        "href": format("?page=%1", [data("currentPage").pipe([transformer::number::add(1)]).into()]),
        "visibleWhen": data("currentPage").matches(condition::number::less_than(data("totalPages"))),
    },
    "items": [
        obj! { "number": "1", "href": "?page=1" },
        obj! {
            "number": "2",
            "href": "?page=2",
            "visibleWhen": data("totalPages").matches(condition::number::greater_than_or_equal(2)),
        },
    ],
})
```
