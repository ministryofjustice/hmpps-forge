---
title: Side Navigation
section: packages
path: packages/moj-components/side-navigation
teaches: [MOJSideNavigation, side-navigation, moj-side-navigation, visibleWhen]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Side navigation

Side navigation provides a vertical list of links. It can be a simple
flat list or grouped into sections with headings.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `MOJSideNavigation` from the MOJ components package.

```typescript
import { MOJSideNavigation } from '@ministryofjustice/hmpps-forge/moj-components'

MOJSideNavigation({
  label: 'Case navigation',
  items: [
    { text: 'Overview', href: '#overview', active: true },
    { text: 'People', href: '#people' },
    { text: 'Timeline', href: '#timeline' },
  ],
})
```

---

## Type interface

{{slot:interface}}

---

## Sections

Use `sections` when the navigation needs grouped links.

{{slot:sections-example}}

```typescript
MOJSideNavigation({
  label: 'Case navigation',
  sections: [
    {
      heading: { text: 'Case', headingLevel: 3 },
      items: [
        { text: 'Overview', href: '#overview', active: true },
        { text: 'Timeline', href: '#timeline' },
      ],
    },
    {
      heading: { text: 'Manage', headingLevel: 3 },
      items: [{ text: 'Documents', href: '#documents' }],
    },
  ],
})
```

---

## Active item

Set `active: true` on the current link so users can see where they
are in the section.

---

## Conditional items and sections

Use `visibleWhen` on an item or section to omit it from rendering.

```typescript
MOJSideNavigation({
  label: 'Case navigation',
  sections: [
    {
      heading: { text: 'Case' },
      items: [
        { text: 'Overview', href: '#overview', active: true },
        {
          text: 'Timeline',
          href: '#timeline',
          visibleWhen: Data('canViewTimeline'),
        },
      ],
    },
    {
      heading: { text: 'Manage' },
      visibleWhen: Session('role').match(Condition.Equals('admin')),
      items: [{ text: 'Documents', href: '#documents' }],
    },
  ],
})
```
