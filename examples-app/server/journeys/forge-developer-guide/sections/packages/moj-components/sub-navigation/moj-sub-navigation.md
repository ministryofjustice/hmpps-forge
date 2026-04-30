---
title: Sub Navigation
section: packages
path: packages/moj-components/sub-navigation
teaches: [MOJSubNavigation, sub-navigation, moj-sub-navigation, visibleWhen]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Sub navigation

Sub navigation lets users move between secondary sections within a
service area. Use it below the main navigation, not as a replacement
for global navigation.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `MOJSubNavigation` from the MOJ components package.

```typescript
import { MOJSubNavigation } from '@ministryofjustice/hmpps-forge/moj-components'

MOJSubNavigation({
  label: 'Case sections',
  items: [
    { text: 'Overview', href: '#overview', active: true },
    { text: 'Documents', href: '#documents' },
    { text: 'Timeline', href: '#timeline' },
  ],
})
```

---

## Type interface

{{slot:interface}}

---

## Active item

Set `active: true` on the current item. The component adds the
appropriate current-page state.

{{slot:items-example}}

```typescript
MOJSubNavigation({
  label: 'Case sections',
  items: [
    { text: 'Overview', href: '#overview' },
    { text: 'Documents', href: '#documents', active: true },
    { text: 'Timeline', href: '#timeline' },
  ],
})
```

---

## Conditional items

Use `visibleWhen` on an item to omit it from rendering.

```typescript
MOJSubNavigation({
  label: 'Case sections',
  items: [
    { text: 'Overview', href: '#overview', active: true },
    {
      text: 'Documents',
      href: '#documents',
      visibleWhen: Data('canViewDocuments'),
    },
    { text: 'Timeline', href: '#timeline' },
  ],
})
```

---

## HTML labels

Use `html` when an item label needs inline markup.

```typescript
MOJSubNavigation({
  items: [
    { html: 'Messages <span class="govuk-visually-hidden">about this case</span>', href: '#messages' },
  ],
})
```
