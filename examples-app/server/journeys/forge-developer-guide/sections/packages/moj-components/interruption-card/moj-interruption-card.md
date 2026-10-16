---
title: Interruption Card
section: packages
path: packages/moj-components/interruption-card
teaches: [MOJInterruptionCard, interruption-card, moj-interruption-card]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Interruption card

Pauses a journey with important information and actions.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

```typescript
import { MOJInterruptionCard } from '@ministryofjustice/hmpps-forge/moj-components'

MOJInterruptionCard({
  heading: 'Before you continue',
  text: 'Check that the case details are correct before sending your request.',
  primaryAction: { text: 'Continue', href: '#continue' },
  secondaryAction: { text: 'Go back', href: '#back' },
})
```

---

## Content and action styles

{{slot:options-example}}

```typescript
MOJInterruptionCard({
  heading: 'Check the reference number',
  html: '<p class="govuk-body">Your case reference is <strong>ABC123</strong>.</p>',
  primaryAction: { text: 'Continue', href: '#continue', style: 'link' },
  secondaryAction: { text: 'Go back', href: '#back', style: 'button' },
})
```

The upstream component includes an `h1`, so use it for a dedicated interruption page. The preview is embedded here for demonstration. `text` is escaped; use trusted `html` or `blocks` for rich content. Child blocks take precedence. The primary action defaults to a button and the secondary action to a link. The wrapper supplies the Nunjucks caller required by the upstream macro.

---

## Reactive values

Use Forge expressions for properties supplied by loaded data.

```typescript
import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'

MOJInterruptionCard({ heading: 'Check the case', text: Data('interruptionMessage'), primaryAction: { text: 'Continue', href: '/case/confirm' } })
```

---

## Options

| Property | Purpose |
| --- | --- |
| `heading` | Required heading. |
| `text, html, blocks` | Body content; blocks take precedence. |
| `primaryAction` | Required text, optional href, style, and button attributes. |
| `secondaryAction` | Optional secondary action with the same options. |

See the [MOJ Interruption Card guidance](https://design-patterns.service.justice.gov.uk/components/interruption-card/) for usage and accessibility advice.
