---
title: Notification Banner
section: packages
path: packages/govuk-components/notification-banner
teaches: [govuk::NOTIFICATION_BANNER, notification-banner, govuk-notification-banner]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Notification banner

A banner that displays important messages at the top of a page. The
component renders the GOV.UK Design System notification banner and
supports standard (blue) and success (green) variants.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::NOTIFICATION_BANNER` from the GOV.UK components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::NOTIFICATION_BANNER.build(obj! {
    "text": "There may be a delay in processing your application.",
})
```

---

## Success banner

Set `"bannerType": "success"` for a green success banner. The title
defaults to "Success" and the banner uses an alert role.

{{slot:success-example}}

```rust
govuk::NOTIFICATION_BANNER.build(obj! {
    "bannerType": "success",
    "html": "You have <a class=\"govuk-notification-banner__link\" href=\"#\">accepted the offer</a>.",
})
```

---

## Custom title

Override the default title with `titleText`.

```rust
govuk::NOTIFICATION_BANNER.build(obj! {
    "titleText": "New",
    "text": "A new version of this form is available.",
})
```

---

## With child blocks

Use `content` to render Forge blocks inside the banner.

```rust
govuk::NOTIFICATION_BANNER.build(obj! {
    "bannerType": "success",
    "titleText": "Success",
    "content": [
        govuk::HEADING.build(obj! { "text": "Training outcome recorded", "size": "m" }),
        govuk::BODY.build(obj! { "text": "Contact the training provider for next steps." }),
    ],
})
```

---

## Conditional visibility

Show the banner only when a condition is met.

```rust
govuk::NOTIFICATION_BANNER.build(obj! {
    "bannerType": "success",
    "text": "Your changes have been saved.",
    "visibleWhen": data("showSavedBanner").matches(condition::equals(true)),
})
```
