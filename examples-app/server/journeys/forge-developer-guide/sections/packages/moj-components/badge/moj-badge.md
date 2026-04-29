---
title: Badge
section: packages
path: packages/moj-components/badge
teaches: [MOJBadge, badge, moj-badge]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Badge

A small coloured label used to show status or category information.
The component renders the Ministry of Justice Design System badge
pattern and supports the standard MOJ badge colour classes.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `MOJBadge` from the MOJ components package.

```typescript
import { MOJBadge } from '@ministryofjustice/hmpps-forge/moj-components'

MOJBadge({ text: 'Complete', classes: 'moj-badge--green' })
```

---

## Colours

Use `moj-badge--{colour}` classes to match the meaning of the status.

{{slot:colours-example}}

```typescript
MOJBadge({ text: 'Urgent', classes: 'moj-badge--red' })
MOJBadge({ text: 'In review', classes: 'moj-badge--blue' })
MOJBadge({ text: 'Complete', classes: 'moj-badge--green' })
MOJBadge({ text: 'Paused', classes: 'moj-badge--dark-grey' })
```

---

## Accessible labels

Use `label` when the badge text is short and needs more context for
screen readers.

```typescript
MOJBadge({
  text: 'High',
  classes: 'moj-badge--red',
  label: 'Risk level: High',
})
```

---

## Dynamic status

Use expressions when the badge text or colour depends on journey data.

```typescript
MOJBadge({
  text: Data('caseStatus.label'),
  classes: Data('caseStatus.badgeClass'),
  label: Data('caseStatus.accessibleLabel'),
})
```
