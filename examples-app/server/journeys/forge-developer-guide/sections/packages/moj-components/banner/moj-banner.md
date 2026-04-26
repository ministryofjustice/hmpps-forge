---
title: Banner
section: packages
path: packages/moj-components/banner
teaches: [MOJBanner, banner, moj-banner]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Banner

A banner that displays important service messages. The component
renders the Ministry of Justice Design System banner pattern and
supports success, warning, and information variants.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `MOJBanner` from the MOJ components package.

```typescript
import { MOJBanner } from '@ministryofjustice/hmpps-forge/moj-components'

MOJBanner({
  bannerType: 'success',
  text: 'Your application has been submitted.',
})
```

---

## Banner types

Set `bannerType` to choose the visual style and icon.

{{slot:types-example}}

```typescript
MOJBanner({ bannerType: 'success', text: 'Visit request approved.' })
MOJBanner({ bannerType: 'warning', text: 'This person has alerts on NOMIS.' })
MOJBanner({ bannerType: 'information', text: 'A case note was added today.' })
```

---

## HTML content

Use `html` when the message needs links or inline formatting.

```typescript
MOJBanner({
  bannerType: 'information',
  html: 'Review the <a href="#" class="govuk-link">case history</a> before continuing.',
})
```

---

## Dynamic content

Use expressions when the banner content depends on loaded data or user
answers.

```typescript
MOJBanner({
  bannerType: Data('banner.type'),
  text: Data('banner.message'),
})
```
