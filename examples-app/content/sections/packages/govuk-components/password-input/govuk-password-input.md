---
title: Password Input
section: packages
path: packages/govuk-components/password-input
teaches: [govuk::PASSWORD_INPUT, password-input, govuk-password-input]
prerequisites: [govuk-components-package, block, validation]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Password input

A text input with a toggle button that lets users show or hide their
password. The component renders the GOV.UK Design System password
input and supports autocomplete hints for current and new passwords.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::PASSWORD_INPUT` from the GOV.UK components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::PASSWORD_INPUT.build(obj! {
    "code": "password",
    "label": "Password",
})
```

---

## Autocomplete

Set `autocomplete` to tell the browser whether this is an existing
password or a new one.

```rust
govuk::PASSWORD_INPUT.build(obj! {
    "code": "currentPassword",
    "label": "Current password",
    "autocomplete": "current-password",
})
govuk::PASSWORD_INPUT.build(obj! {
    "code": "newPassword",
    "label": "Create a password",
    "autocomplete": "new-password",
})
```

---

## With a hint

{{slot:hint-example}}

```rust
govuk::PASSWORD_INPUT.build(obj! {
    "code": "newPassword",
    "label": obj! {
        "text": "Create a password",
        "classes": classes::label::MEDIUM,
    },
    "hint": "Your password must be at least 8 characters and contain at least one number.",
    "autocomplete": "new-password",
})
```

---

## Additional descriptions

Use `describedBy` to add extra element IDs to the password input's
`aria-describedby` attribute. This is useful when another element on
the page provides guidance that should be announced by screen readers.

```rust
govuk::PASSWORD_INPUT.build(obj! {
    "code": "newPassword",
    "label": "Create a password",
    "describedBy": "password-requirements",
    "autocomplete": "new-password",
})
```

---

## Validation

```rust
govuk::PASSWORD_INPUT.build(obj! {
    "code": "password",
    "label": "Password",
    "autocomplete": "current-password",
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter your password",
        }),
    ],
})
```

---

## Custom toggle text

Override the show/hide button text for different languages or
wording.

```rust
govuk::PASSWORD_INPUT.build(obj! {
    "code": "password",
    "label": "Password",
    "showPasswordText": "Show",
    "hidePasswordText": "Hide",
})
```
