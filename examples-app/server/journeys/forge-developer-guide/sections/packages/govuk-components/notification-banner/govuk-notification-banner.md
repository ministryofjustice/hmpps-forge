---
title: Notification Banner
section: packages
path: packages/govuk-components/notification-banner
teaches: [GovUKNotificationBanner, notification-banner, govuk-notification-banner]
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

Import `GovUKNotificationBanner` from the GOV.UK components package.

```typescript
import { GovUKNotificationBanner } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKNotificationBanner({
  text: 'There may be a delay in processing your application.',
})
```

---

## Type interface

{{slot:interface}}

---

## Success banner

Set `bannerType: 'success'` for a green success banner. The title
defaults to "Success" and the banner uses an alert role.

{{slot:success-example}}

```typescript
GovUKNotificationBanner({
  bannerType: 'success',
  html: 'You have <a class="govuk-notification-banner__link" href="#">accepted the offer</a>.',
})
```

---

## Custom title

Override the default title with `titleText`.

```typescript
GovUKNotificationBanner({
  titleText: 'New',
  text: 'A new version of this form is available.',
})
```

---

## With child blocks

Use `content` to render Forge blocks inside the banner.

```typescript
GovUKNotificationBanner({
  bannerType: 'success',
  titleText: 'Success',
  content: [
    GovUKHeading({ text: 'Training outcome recorded', size: 'm' }),
    GovUKBody({ text: 'Contact the training provider for next steps.' }),
  ],
})
```

---

## Conditional visibility

Show the banner only when a condition is met.

```typescript
GovUKNotificationBanner({
  bannerType: 'success',
  text: 'Your changes have been saved.',
  visibleWhen: Data('showSavedBanner').match(Condition.Equals(true)),
})
```
