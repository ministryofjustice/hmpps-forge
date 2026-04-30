---
title: Button Group
section: packages
path: packages/govuk-components/button-group
teaches: [GovUKButtonGroup, button-group, govuk-button-group]
prerequisites: [govuk-components-package, block, govuk-button]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Button group

A container that arranges buttons and links in a row on desktop and
stacks them on mobile. Use it when a page has more than one action.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKButtonGroup` from the GOV.UK components package. Pass
an array of buttons or link buttons.

```typescript
import { GovUKButtonGroup, GovUKButton, GovUKLinkButton } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKButtonGroup({
  buttons: [
    GovUKButton({ text: 'Save and continue' }),
    GovUKLinkButton({ text: 'Cancel', href: '/overview', classes: 'govuk-button--secondary' }),
  ],
})
```

---

## Type interface

{{slot:interface}}

---

## Primary and secondary

Pair a primary button with a secondary action.

{{slot:primary-secondary-example}}

```typescript
GovUKButtonGroup({
  buttons: [
    GovUKButton({ text: 'Submit' }),
    GovUKButton({ text: 'Save as draft', classes: 'govuk-button--secondary' }),
  ],
})
```

---

## With warning button

```typescript
GovUKButtonGroup({
  buttons: [
    GovUKButton({ text: 'Save changes' }),
    GovUKButton({ text: 'Delete', classes: 'govuk-button--warning' }),
  ],
})
```
