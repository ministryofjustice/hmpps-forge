---
title: Password Input
section: packages
path: packages/govuk-components/password-input
teaches: [GovUKPasswordInput, password-input, govuk-password-input]
prerequisites: [govuk-components-package, block, validation]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Password input

A text input with a toggle button that lets users show or hide their
password. The component renders the GOV.UK Design System password
input and supports autocomplete hints for current and new passwords.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKPasswordInput` from the GOV.UK components package.

```typescript
import { GovUKPasswordInput } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKPasswordInput({
  code: 'password',
  label: 'Password',
})
```

---

## Autocomplete

Set `autocomplete` to tell the browser whether this is an existing
password or a new one.

```typescript
GovUKPasswordInput({
  code: 'currentPassword',
  label: 'Current password',
  autocomplete: 'current-password',
})

GovUKPasswordInput({
  code: 'newPassword',
  label: 'Create a password',
  autocomplete: 'new-password',
})
```

---

## With a hint

{{slot:hint-example}}

```typescript
GovUKPasswordInput({
  code: 'newPassword',
  label: {
    text: 'Create a password',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  hint: 'Your password must be at least 8 characters and contain at least one number.',
  autocomplete: 'new-password',
})
```

---

## Validation

```typescript
GovUKPasswordInput({
  code: 'password',
  label: 'Password',
  autocomplete: 'current-password',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your password',
    }),
  ],
})
```

---

## Custom toggle text

Override the show/hide button text for different languages or
wording.

```typescript
GovUKPasswordInput({
  code: 'password',
  label: 'Password',
  showPasswordText: 'Show',
  hidePasswordText: 'Hide',
})
```
