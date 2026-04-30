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
`text`, `html`, or `blocks` as content.

```typescript
import { GovUKInsetText } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKInsetText({
  text: 'It can take up to 8 weeks to register a lasting power of attorney if there are no mistakes in the application.',
})
```

---

## Type interface

{{slot:interface}}

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

## With child blocks

Use `blocks` when the inset text content is easier to compose from
other Forge blocks. Blocks take precedence over `text` and `html`.

{{slot:blocks-example}}

```typescript
GovUKInsetText({
  blocks: [
    GovUKBody({ text: 'Bring one proof of identity to your appointment.' }),
    GovUKBody({ text: 'A passport or driving licence is usually enough.', classes: 'govuk-!-margin-bottom-0' }),
  ],
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
