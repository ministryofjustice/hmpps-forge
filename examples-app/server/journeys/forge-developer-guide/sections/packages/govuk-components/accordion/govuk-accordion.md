---
title: Accordion
section: packages
path: packages/govuk-components/accordion
teaches: [GovUKAccordion, accordion, govuk-accordion]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Accordion

A vertically stacked set of expandable sections. The component
renders the GOV.UK Design System accordion and supports summaries,
child blocks, persistent state, and conditional sections.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKAccordion` from the GOV.UK components package. Every
accordion needs a unique `id` and an `items` array.

```typescript
import { GovUKAccordion } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKAccordion({
  id: 'writing-guide',
  items: [
    {
      heading: { text: 'Writing well for the web' },
      content: { text: 'This is the content for writing well for the web.' },
    },
    {
      heading: { text: 'Writing well for specialists' },
      content: { text: 'This is the content for writing for specialists.' },
    },
  ],
})
```

---

## Type interface

{{slot:interface}}

---

## With summaries

Add a `summary` to each item to give users more context before they
expand the section.

{{slot:summary-example}}

```typescript
GovUKAccordion({
  id: 'guidance-accordion',
  items: [
    {
      heading: { text: 'Understanding agile' },
      summary: { text: 'Principles, values, and best practices' },
      content: { text: 'Agile is an iterative approach to project management.' },
    },
    {
      heading: { text: 'Working in sprints' },
      summary: { text: 'Planning, standups, and retrospectives' },
      content: { text: 'Sprints are short, time-boxed periods of work.' },
    },
  ],
})
```

---

## Expanded by default

Set `expanded: true` on an item to render it open.

```typescript
{
  heading: { text: 'Important section' },
  content: { text: 'This section starts expanded.' },
  expanded: true,
}
```

---

## With child blocks

Use `content.blocks` to render Forge blocks inside a section.

```typescript
{
  heading: { text: 'Contact details' },
  content: {
    blocks: [
      GovUKBody({ text: 'Email: support@example.com' }),
      GovUKBody({ text: 'Phone: 0800 123 4567' }),
    ],
  },
}
```

---

## Persistent state

By default the accordion remembers which sections the user has
expanded using session storage. Set `rememberExpanded: false` to
disable this.

```typescript
GovUKAccordion({
  id: 'faq',
  rememberExpanded: false,
  items: [/* ... */],
})
```
