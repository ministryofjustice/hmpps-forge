---
title: Filter
section: packages
path: packages/moj-components/filter
teaches: [moj::FILTER, filter, moj-filter, visibleWhen]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Filter

A filter displays filter controls and selected filter tags. Use it on
search and list pages where users can narrow a result set.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `moj::FILTER` from the MOJ components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::FILTER.build(obj! {
    "heading": obj! { "text": "Filter" },
    "submit": obj! { "text": "Apply filters" },
    "optionsHtml": "<div class=\"govuk-form-group\">...</div>",
})
```

---

## Selected filters

Use `selectedFilters` to show active filters as removable tags.

{{slot:selected-example}}

```rust
moj::FILTER.build(obj! {
    "heading": obj! { "text": "Filter" },
    "selectedFilters": obj! {
        "heading": obj! { "text": "Selected filters" },
        "clearLink": obj! { "href": "#clear", "text": "Clear filters" },
        "categories": [
            obj! {
                "heading": obj! { "text": "Status" },
                "items": [obj! { "text": "Open", "href": "#remove-open" }],
            },
        ],
    },
    "submit": obj! { "text": "Apply filters" },
    "optionsHtml": "<div class=\"govuk-form-group\">...</div>",
})
```

---

## Conditional selected filters

Use `visibleWhen` on selected filter categories or individual tag
items to omit them from rendering.

```rust
moj::FILTER.build(obj! {
    "heading": obj! { "text": "Filter" },
    "selectedFilters": obj! {
        "heading": obj! { "text": "Selected filters" },
        "clearLink": obj! { "href": "#clear", "text": "Clear filters" },
        "categories": [
            obj! {
                "heading": obj! { "text": "Status" },
                "items": [
                    obj! { "text": "Open", "href": "#remove-open" },
                    obj! {
                        "text": "Restricted",
                        "href": "#remove-restricted",
                        "visibleWhen": session("role").matches(condition::equals("admin")),
                    },
                ],
            },
            obj! {
                "heading": obj! { "text": "Team" },
                "visibleWhen": data("teamFiltersApplied"),
                "items": [obj! { "text": "Visits", "href": "#remove-visits" }],
            },
        ],
    },
})
```

---

## Filter controls

`optionsHtml` should contain the form controls for filtering. Keep the
controls short and focused so the panel remains scannable.

```rust
moj::FILTER.build(obj! {
    "heading": obj! { "text": "Filter" },
    "submit": obj! { "text": "Apply filters" },
    "optionsHtml": "\n    <div class=\"govuk-form-group\">\n      <label class=\"govuk-label\" for=\"status\">Status</label>\n      <select class=\"govuk-select\" id=\"status\" name=\"status\">\n        <option value=\"\">Any status</option>\n        <option value=\"open\">Open</option>\n      </select>\n    </div>\n  ",
})
```
