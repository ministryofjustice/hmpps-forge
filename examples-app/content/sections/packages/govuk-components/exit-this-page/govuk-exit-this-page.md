---
title: Exit This Page
section: packages
path: packages/govuk-components/exit-this-page
teaches: [govuk::EXIT_THIS_PAGE, exit-this-page, govuk-exit-this-page]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Exit this page

An emergency exit button that quickly redirects the user to an
external site. Use it on services where users may be at risk and
need to leave the page immediately. The component renders the
GOV.UK Design System "Exit this page" pattern.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::EXIT_THIS_PAGE` from the GOV.UK components package. By
default it redirects to the BBC Weather page and displays "Emergency
Exit this page".

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::EXIT_THIS_PAGE.build(obj! {})
```

---

## Custom redirect

Set `redirectUrl` to change where the user is taken.

```rust
govuk::EXIT_THIS_PAGE.build(obj! {
    "redirectUrl": "https://www.google.co.uk",
})
```

---

## Custom text

```rust
govuk::EXIT_THIS_PAGE.build(obj! {
    "text": "Leave this page",
})
```

---

## Keyboard shortcut

The component includes a built-in keyboard shortcut. Pressing the
Shift key three times in quick succession triggers the redirect.
Screen reader announcements guide the user through this interaction.
