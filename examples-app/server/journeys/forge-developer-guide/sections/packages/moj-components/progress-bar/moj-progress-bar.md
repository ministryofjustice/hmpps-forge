---
title: Progress Bar
section: packages
path: packages/moj-components/progress-bar
teaches: [MOJProgressBar, progress-bar, moj-progress-bar, visibleWhen]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Progress bar

A progress bar shows where the user is in a linear multi-step
process. It marks completed steps, the current active step, and
upcoming steps.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `MOJProgressBar` from the MOJ components package.

```typescript
import { MOJProgressBar } from '@ministryofjustice/hmpps-forge/moj-components'

MOJProgressBar({
  label: 'Application progress',
  items: [
    { label: 'Personal details', complete: true },
    { label: 'Contact information', active: true },
    { label: 'Review and submit' },
  ],
})
```

---

## Active and complete steps

Set `complete: true` for finished steps and `active: true` for the
current step. Only one step should normally be active.

{{slot:long-example}}

```typescript
MOJProgressBar({
  label: 'Visit booking progress',
  items: [
    { label: 'Choose prisoner', complete: true },
    { label: 'Choose date', complete: true },
    { label: 'Visitor details', active: true },
    { label: 'Check answers' },
  ],
})
```

---

## Custom labels

Use label objects when an item needs custom classes.

```typescript
MOJProgressBar({
  label: 'Case review progress',
  items: [
    { label: { text: 'Prepare', classes: 'govuk-!-font-weight-bold' }, complete: true },
    { label: 'Review', active: true },
    { label: 'Submit' },
  ],
})
```

---

## Conditional steps

Use `visibleWhen` on an item to omit steps that do not apply to the
current journey.

```typescript
MOJProgressBar({
  label: 'Application progress',
  items: [
    { label: 'Personal details', complete: true },
    {
      label: 'Security review',
      active: true,
      visibleWhen: Data('requiresSecurityReview'),
    },
    { label: 'Review and submit' },
  ],
})
```
