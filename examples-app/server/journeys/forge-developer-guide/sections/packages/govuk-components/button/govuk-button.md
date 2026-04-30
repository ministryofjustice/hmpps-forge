---
title: Button
section: packages
path: packages/govuk-components/button
teaches: [GovUKButton, GovUKLinkButton, button, govuk-button, govuk-link-button]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Button

Buttons trigger actions or navigate to other pages. The package
provides two components: `GovUKButton` for form submissions and
`GovUKLinkButton` for navigation styled as a button.

{{slot:basic-example}}

{{slot:toc}}

---

## GovUKButton

A `<button>` element for form actions. It defaults to `type="submit"`
and `name="action"`.

```typescript
import { GovUKButton } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKButton({ text: 'Continue' })
```

### Button value

Use `value` to distinguish between multiple buttons on a page.
Check the submitted value with `Post('action')` in submit hooks.

```typescript
GovUKButton({ text: 'Save and continue', value: 'continue' })
GovUKButton({ text: 'Save as draft', value: 'draft', classes: 'govuk-button--secondary' })
```

### Prevent double clicks

Set `preventDoubleClick: true` to disable the button after the first
click, preventing duplicate submissions.

```typescript
GovUKButton({
  text: 'Submit application',
  preventDoubleClick: true,
})
```

### Disabled state

```typescript
GovUKButton({
  text: 'Submit',
  disabled: true,
})
```

---

## Type interface

{{slot:interface}}

---

## GovUKLinkButton

An `<a>` element styled as a button. Use it for navigation actions
that look like buttons. The `href` property is required.

{{slot:link-example}}

```typescript
import { GovUKLinkButton } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKLinkButton({
  text: 'Start now',
  href: '/application/start',
})
```

---

## Styles

### Secondary

Use `govuk-button--secondary` for less prominent actions.

{{slot:secondary-example}}

```typescript
GovUKButton({ text: 'Save as draft', classes: 'govuk-button--secondary' })
GovUKLinkButton({ text: 'Cancel', href: '/overview', classes: 'govuk-button--secondary' })
```

### Warning

Use `govuk-button--warning` for destructive actions like delete.

{{slot:warning-example}}

```typescript
GovUKButton({ text: 'Delete account', classes: 'govuk-button--warning' })
```

### Start button

Use `isStartButton: true` for the main call-to-action on a start
page. This adds an arrow icon.

{{slot:start-example}}

```typescript
GovUKLinkButton({
  text: 'Start now',
  href: '/application/start',
  isStartButton: true,
})
```

---

## Dynamic href

Use expressions for dynamic navigation links.

```typescript
GovUKLinkButton({
  text: 'View details',
  href: Format('/cases/%1', Answer('caseId')),
})
```
