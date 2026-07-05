---
title: Details
section: packages
path: packages/govuk-components/details
teaches: [GovUKDetails, details, govuk-details]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Details

An expandable disclosure component that lets users reveal additional
content. The component renders the GOV.UK Design System details
element and supports plain text, HTML, and child blocks as content.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKDetails` from the GOV.UK components package. Every
details component needs a clickable label - `summaryText`, or
`summaryHtml` for markup - and content to reveal.

```typescript
import { GovUKDetails } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKDetails({
  summaryText: 'Help with nationality',
  text: 'If you are not sure about your nationality, try to find out from an official document such as a passport or national ID card.',
})
```

---

## Content types

### Plain text

```typescript
GovUKDetails({
  summaryText: 'What happens next',
  text: 'We will review your application and contact you within 5 working days.',
})
```

### HTML content

Use `html` when you need formatting, links, or other markup.

{{slot:html-example}}

```typescript
GovUKDetails({
  summaryText: 'Where to find your reference number',
  html: 'Your reference number is on the letter we sent you. It starts with <strong>HDJ</strong> followed by 4 numbers and a letter.',
})
```

### Child blocks

Use `content` to render other Forge blocks inside the expandable
section.

```typescript
GovUKDetails({
  summaryText: 'View contact details',
  content: [
    GovUKBody({ text: 'Email: support@example.com' }),
    GovUKBody({ text: 'Phone: 0800 123 4567' }),
  ],
})
```

---

## Open by default

Set `open: true` to render the component in its expanded state.

```typescript
GovUKDetails({
  summaryText: 'Important information',
  text: 'This section contains details you should read before continuing.',
  open: true,
})
```
