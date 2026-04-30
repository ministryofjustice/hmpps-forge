---
title: Body
section: packages
path: packages/govuk-components/body
teaches: [GovUKBody, body, govuk-body]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Body

A paragraph of body text. The component renders a `<p>` element
with GOV.UK Design System typography classes and supports size
variants and dynamic content.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKBody` from the GOV.UK components package.

```typescript
import { GovUKBody } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKBody({ text: 'This is a paragraph of body text.' })
```

---

## Type interface

{{slot:interface}}

---

## Size variants

Use the `size` property to change the text size.

{{slot:sizes-example}}

```typescript
GovUKBody({ text: 'Lead paragraph text at 24px.', size: 'l' })
GovUKBody({ text: 'Default body text at 19px.' })
GovUKBody({ text: 'Small body text at 16px.', size: 's' })
```

---

## Dynamic content

Use expressions for text that depends on user answers or loaded
data.

```typescript
GovUKBody({
  text: Format('Your reference number is %1.', Answer('referenceNumber')),
})
```
