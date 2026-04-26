---
title: Inset Text
section: packages
path: packages/govuk-components/inset-text
teaches: [GovUKInsetText, inset-text, govuk-inset-text]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Inset text

A bordered block of text used to draw attention to important content.
The component renders the GOV.UK Design System inset text pattern
with a left border.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKInsetText` from the GOV.UK components package. Provide
either `text` or `html` as content.

```typescript
import { GovUKInsetText } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKInsetText({
  text: 'It can take up to 8 weeks to register a lasting power of attorney if there are no mistakes in the application.',
})
```

---

## HTML content

Use `html` when you need links or formatting within the inset text.

{{slot:html-example}}

```typescript
GovUKInsetText({
  html: 'You can <a class="govuk-link" href="/appeal">appeal the decision</a> if you think it is wrong.',
})
```

---

## Dynamic content

Use expressions to display content based on user answers or loaded
data.

```typescript
GovUKInsetText({
  text: Format('Your reference number is %1. Keep this safe.', Answer('referenceNumber')),
})
```

---

## Conditional visibility

Show the inset text only when a condition is met.

```typescript
GovUKInsetText({
  text: 'You have read-only access to this record.',
  visibleWhen: Data('isReadOnly').match(Condition.Equals(true)),
})
```
