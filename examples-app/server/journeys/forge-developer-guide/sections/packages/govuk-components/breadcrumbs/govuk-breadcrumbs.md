---
title: Breadcrumbs
section: packages
path: packages/govuk-components/breadcrumbs
teaches: [GovUKBreadcrumbs, breadcrumbs, govuk-breadcrumbs]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Breadcrumbs

A navigation trail showing the user's location within the site
hierarchy. The component renders the GOV.UK Design System
breadcrumbs.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKBreadcrumbs` from the GOV.UK components package. Each
item has `text` and an optional `href`. The last item is typically
the current page and has no link.

```typescript
import { GovUKBreadcrumbs } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKBreadcrumbs({
  items: [
    { text: 'Home', href: '/' },
    { text: 'Cases', href: '/cases' },
    { text: 'Case details' },
  ],
})
```

---

## Type interface

{{slot:interface}}

---

## Collapse on mobile

Set `collapseOnMobile: true` to show only the parent link on small
screens, saving vertical space.

{{slot:collapsed-example}}

```typescript
GovUKBreadcrumbs({
  collapseOnMobile: true,
  items: [
    { text: 'Home', href: '/' },
    { text: 'Cases', href: '/cases' },
    { text: 'Active cases', href: '/cases/active' },
    { text: 'Case details' },
  ],
})
```

---

## Dynamic items

Use expressions for dynamic breadcrumb trails.

```typescript
GovUKBreadcrumbs({
  items: [
    { text: 'Home', href: '/' },
    { text: 'Cases', href: '/cases' },
    { text: Data('caseName') },
  ],
})
```
