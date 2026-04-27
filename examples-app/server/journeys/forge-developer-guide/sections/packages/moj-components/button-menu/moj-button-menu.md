---
title: Button Menu
section: packages
path: packages/moj-components/button-menu
teaches: [MOJButtonMenu, button-menu, moj-button-menu, visibleWhen]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Button menu

A button menu groups related actions behind a single button. Use it
when a page has several secondary actions and showing them all as
separate buttons would add clutter.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `MOJButtonMenu` from the MOJ components package.

```typescript
import { MOJButtonMenu } from '@ministryofjustice/hmpps-forge/moj-components'

MOJButtonMenu({
  button: { text: 'Actions', classes: 'govuk-button--secondary' },
  items: [
    { text: 'Archive', href: '#archive' },
    { text: 'Reassign', href: '#reassign' },
    { text: 'Delete', href: '#delete', classes: 'govuk-button--warning' },
  ],
})
```

---

## Align the menu

Set `alignMenu: 'right'` when the menu should align to the right edge
of the button.

{{slot:aligned-example}}

```typescript
MOJButtonMenu({
  button: { text: 'More actions', classes: 'govuk-button--secondary' },
  alignMenu: 'right',
  items: [
    { text: 'Print', href: '#print' },
    { text: 'Export', href: '#export' },
  ],
})
```

---

## Submit actions

Menu items can submit a form by using `name`, `value`, and `type`.

```typescript
MOJButtonMenu({
  button: { text: 'Save options' },
  items: [
    { text: 'Save and continue', name: 'action', value: 'continue' },
    { text: 'Save as draft', name: 'action', value: 'draft' },
  ],
})
```

---

## Conditional items

Use `visibleWhen` on a menu item to omit actions the current user or
journey state should not show.

```typescript
MOJButtonMenu({
  button: { text: 'Actions' },
  items: [
    { text: 'Print', href: '#print' },
    {
      text: 'Delete',
      href: '#delete',
      classes: 'govuk-button--warning',
      visibleWhen: Session('role').match(Condition.Equals('admin')),
    },
  ],
})
```
