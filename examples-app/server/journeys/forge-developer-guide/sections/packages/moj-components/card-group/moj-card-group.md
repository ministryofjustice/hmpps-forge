---
title: Card Group
section: packages
path: packages/moj-components/card-group
teaches: [MOJCardGroup, card-group, moj-card-group]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Card group

A card group renders multiple MOJ cards in a responsive grid. Use it
for dashboards, task selection pages, or grouped links where each card
has the same visual treatment.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `MOJCardGroup` from the MOJ components package.

```typescript
import { MOJCardGroup } from '@ministryofjustice/hmpps-forge/moj-components'

MOJCardGroup({
  items: [
    { heading: 'Search cases', href: '#search', description: 'Find and manage case records.' },
    { heading: 'Reports', href: '#reports', description: 'View service reports.' },
  ],
})
```

---

## Type interface

{{slot:interface}}

---

## Columns

Set `columns` to control the grid width. Supported values are `2`,
`3`, and `4`.

{{slot:columns-example}}

```typescript
MOJCardGroup({
  columns: 2,
  items: [
    { heading: 'People', href: '#people', description: 'Manage people records.' },
    { heading: 'Appointments', href: '#appointments', description: 'Manage upcoming visits.' },
  ],
})
```

---

## Conditional cards

Use `visibleWhen` on individual items when a card depends on journey
state or user permissions.

```typescript
MOJCardGroup({
  items: [
    { heading: 'Overview', href: '#overview' },
    {
      heading: 'Restricted reports',
      href: '#reports',
      visibleWhen: Data('canViewReports'),
    },
  ],
})
```
