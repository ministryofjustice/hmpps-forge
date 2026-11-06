---
title: Button Menu
section: packages
path: packages/moj-components/button-menu
teaches: [moj::BUTTON_MENU, button-menu, moj-button-menu, visibleWhen]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Button menu

A button menu groups related actions behind a single button. Use it
when a page has several secondary actions and showing them all as
separate buttons would add clutter.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `moj::BUTTON_MENU` from the MOJ components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_moj_components::blocks as moj;

moj::BUTTON_MENU.build(obj! {
    "button": obj! { "text": "Actions", "classes": "govuk-button--secondary" },
    "items": [
        obj! { "text": "Archive", "href": "#archive" },
        obj! { "text": "Reassign", "href": "#reassign" },
        obj! { "text": "Delete", "href": "#delete", "classes": "govuk-button--warning" },
    ],
})
```

---

## Align the menu

Set `"alignMenu": "right"` when the menu should align to the right edge
of the button.

{{slot:aligned-example}}

```rust
moj::BUTTON_MENU.build(obj! {
    "button": obj! { "text": "More actions", "classes": "govuk-button--secondary" },
    "alignMenu": "right",
    "items": [
        obj! { "text": "Print", "href": "#print" },
        obj! { "text": "Export", "href": "#export" },
    ],
})
```

---

## Submit actions

Menu items can submit a form by using `name`, `value`, and `type`.

```rust
moj::BUTTON_MENU.build(obj! {
    "button": obj! { "text": "Save options" },
    "items": [
        obj! { "text": "Save and continue", "name": "action", "value": "continue" },
        obj! { "text": "Save as draft", "name": "action", "value": "draft" },
    ],
})
```

---

## Conditional items

Use `visibleWhen` on a menu item to omit actions the current user or
journey state should not show.

```rust
moj::BUTTON_MENU.build(obj! {
    "button": obj! { "text": "Actions" },
    "items": [
        obj! { "text": "Print", "href": "#print" },
        obj! {
            "text": "Delete",
            "href": "#delete",
            "classes": "govuk-button--warning",
            "visibleWhen": session("role").matches(condition::equals("admin")),
        },
    ],
})
```
