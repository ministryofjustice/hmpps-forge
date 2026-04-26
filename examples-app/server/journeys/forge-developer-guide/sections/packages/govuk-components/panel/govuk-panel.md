---
title: Panel
section: packages
path: packages/govuk-components/panel
teaches: [GovUKPanel, panel, govuk-panel]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Panel

A large green confirmation panel typically used on success or
completion pages. The component renders the GOV.UK Design System
panel and supports a title and body text.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKPanel` from the GOV.UK components package. Provide a
`titleText` and optionally body content.

```typescript
import { GovUKPanel } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKPanel({
  titleText: 'Application complete',
  text: 'Your reference number is HDJ2123F',
})
```

---

## With a reference number

The panel body is commonly used to display a reference number or
confirmation code.

{{slot:reference-example}}

```typescript
GovUKPanel({
  titleText: 'Application complete',
  html: 'Your reference number<br><strong>HDJ2123F</strong>',
})
```

---

## Dynamic content

Use expressions to display computed values.

```typescript
GovUKPanel({
  titleText: 'Booking confirmed',
  text: Format('Your booking reference is %1', Answer('bookingReference')),
})
```

---

## Heading level

By default the title renders as an `<h1>`. Change it with
`headingLevel` when the panel is not the primary heading.

```typescript
GovUKPanel({
  titleText: 'Section complete',
  headingLevel: 2,
})
```
