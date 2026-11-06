---
title: Button
section: packages
path: packages/govuk-components/button
teaches: [govuk::BUTTON, govuk::LINK_BUTTON, button, govuk-button, govuk-link-button]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Button

Buttons trigger actions or navigate to other pages. The package
provides two components: `govuk::BUTTON` for form submissions and
`govuk::LINK_BUTTON` for navigation styled as a button.

{{slot:basic-example}}

{{slot:toc}}

---

## GovUKButton

A `<button>` element for form actions. It defaults to `type="submit"`
and `name="action"`.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::BUTTON.build(obj! { "text": "Continue" })
```

### Button value

Use `value` to distinguish between multiple buttons on a page.
Check the submitted value with `post("action")` in submit hooks.

```rust
govuk::BUTTON.build(obj! { "text": "Save and continue", "value": "continue" })
govuk::BUTTON.build(obj! {
    "text": "Save as draft",
    "value": "draft",
    "classes": "govuk-button--secondary",
})
```

### Prevent double clicks

Set `"preventDoubleClick": true` to disable the button after the first
click, preventing duplicate submissions.

```rust
govuk::BUTTON.build(obj! {
    "text": "Submit application",
    "preventDoubleClick": true,
})
```

### Disabled state

```rust
govuk::BUTTON.build(obj! {
    "text": "Submit",
    "disabled": true,
})
```

---

## GovUKLinkButton

An `<a>` element styled as a button. Use it for navigation actions
that look like buttons. The `href` property is required.

{{slot:link-example}}

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::LINK_BUTTON.build(obj! {
    "text": "Start now",
    "href": "/application/start",
})
```

---

## Styles

### Secondary

Use `govuk-button--secondary` for less prominent actions.

{{slot:secondary-example}}

```rust
govuk::BUTTON.build(obj! { "text": "Save as draft", "classes": "govuk-button--secondary" })
govuk::LINK_BUTTON.build(obj! {
    "text": "Cancel",
    "href": "/overview",
    "classes": "govuk-button--secondary",
})
```

### Warning

Use `govuk-button--warning` for destructive actions like delete.

{{slot:warning-example}}

```rust
govuk::BUTTON.build(obj! { "text": "Delete account", "classes": "govuk-button--warning" })
```

### Start button

Use `"isStartButton": true` for the main call-to-action on a start
page. This adds an arrow icon.

{{slot:start-example}}

```rust
govuk::LINK_BUTTON.build(obj! {
    "text": "Start now",
    "href": "/application/start",
    "isStartButton": true,
})
```

---

## Dynamic href

Use expressions for dynamic navigation links.

```rust
govuk::LINK_BUTTON.build(obj! {
    "text": "View details",
    "href": format("/cases/%1", [answer("caseId").into()]),
})
```
