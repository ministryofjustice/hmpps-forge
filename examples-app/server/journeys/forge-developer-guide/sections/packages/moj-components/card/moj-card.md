---
title: Card
section: packages
path: packages/moj-components/card
teaches: [MOJCard, card, moj-card]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Card

A card presents a prominent link with supporting text. Use cards for
dashboard-style pages where users need to choose between several
service areas or tasks.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `MOJCard` from the MOJ components package.

```typescript
import { MOJCard } from '@ministryofjustice/hmpps-forge/moj-components'

MOJCard({
  heading: 'Search cases',
  href: '#search-cases',
  description: 'Find and manage case records.',
})
```

---

## Heading options

Use a heading object when you need to control the heading level or
classes.

{{slot:heading-example}}

```typescript
MOJCard({
  heading: { text: 'Manage appointments', level: 3 },
  href: '#appointments',
  description: 'Create, update, and cancel visits.',
})
```

---

## HTML descriptions

Use `description.html` when the supporting text needs inline markup.

```typescript
MOJCard({
  heading: 'Risk information',
  href: '#risk',
  description: {
    html: 'Review <strong>active alerts</strong> before continuing.',
  },
})
```
