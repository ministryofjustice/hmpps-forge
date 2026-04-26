---
title: Alert
section: packages
path: packages/moj-components/alert
teaches: [MOJAlert, alert, moj-alert]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Alert

An alert displays an important message that needs the user's
attention. The component renders the Ministry of Justice Design
System alert pattern and supports information, success, warning, and
error variants.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `MOJAlert` from the MOJ components package.

```typescript
import { MOJAlert } from '@ministryofjustice/hmpps-forge/moj-components'

MOJAlert({
  alertVariant: 'success',
  title: 'Application submitted',
  text: 'Your changes have been saved successfully.',
  showTitleAsHeading: true,
})
```

---

## Variants

Set `alertVariant` to choose the alert style.

{{slot:variants-example}}

```typescript
MOJAlert({ alertVariant: 'information', title: 'Information', text: 'A new case note was added.' })
MOJAlert({ alertVariant: 'success', title: 'Success', text: 'The record was updated.' })
MOJAlert({ alertVariant: 'warning', title: 'Warning', text: 'This person has active alerts.' })
MOJAlert({ alertVariant: 'error', title: 'Error', text: 'The record could not be saved.' })
```

---

## Heading title

Use `showTitleAsHeading` when the alert title should be visible as a
heading, and choose the heading level with `headingTag`.

```typescript
MOJAlert({
  alertVariant: 'warning',
  title: 'Check the risk information',
  text: 'This case has changed since you last viewed it.',
  showTitleAsHeading: true,
  headingTag: 'h3',
})
```

---

## Dismissible alerts

Set `dismissible: true` when users can close the alert.

```typescript
MOJAlert({
  alertVariant: 'information',
  title: 'New message',
  text: 'You have a new message from the case team.',
  dismissible: true,
  dismissText: 'Close',
})
```
