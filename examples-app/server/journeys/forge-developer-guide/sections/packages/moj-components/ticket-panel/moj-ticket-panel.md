---
title: Ticket Panel
section: packages
path: packages/moj-components/ticket-panel
teaches: [MOJTicketPanel, ticket-panel, moj-ticket-panel, visibleWhen]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Ticket panel

A ticket panel displays key summary information in one or more styled
sections. Use it for references, outcomes, booking details, or other
high-importance information.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `MOJTicketPanel` from the MOJ components package.

```typescript
import { MOJTicketPanel } from '@ministryofjustice/hmpps-forge/moj-components'

MOJTicketPanel({
  items: [
    {
      html: '<h2 class="govuk-heading-m">Application submitted</h2><p>Reference: ABC123</p>',
      classes: 'moj-ticket-panel__content--green',
    },
  ],
})
```

---

## Multiple sections

Use multiple `items` when the panel needs separate content areas.

{{slot:sections-example}}

```typescript
MOJTicketPanel({
  attributes: { 'aria-label': 'Application summary' },
  items: [
    {
      html: '<h2 class="govuk-heading-m">Application submitted</h2><p>Reference: ABC123</p>',
      classes: 'moj-ticket-panel__content--green',
    },
    {
      text: 'We will email you within 24 hours to confirm your application.',
    },
  ],
})
```

---

## Conditional sections

Use `visibleWhen` on an item to omit a ticket panel section from
rendering.

```typescript
MOJTicketPanel({
  attributes: { 'aria-label': 'Application summary' },
  items: [
    {
      text: 'Application submitted',
      classes: 'moj-ticket-panel__content--green',
    },
    {
      text: 'Security review required',
      classes: 'moj-ticket-panel__content--yellow',
      visibleWhen: Data('requiresSecurityReview'),
    },
  ],
})
```

---

## Colour classes

Use modifier classes such as
`moj-ticket-panel__content--green`,
`moj-ticket-panel__content--blue`, or
`moj-ticket-panel__content--red` to distinguish section types.
