---
title: Heading
section: packages
path: packages/govuk-components/heading
teaches: [GovUKHeading, heading, govuk-heading]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Heading

A heading element with GOV.UK Design System typography. The
component supports visual size variants, configurable heading
levels, captions, and dynamic content.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKHeading` from the GOV.UK components package.

```typescript
import { GovUKHeading } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKHeading({ text: 'Page title' })
```

---

## Type interface

{{slot:interface}}

---

## Size

The `size` property controls the visual size. The heading level
defaults based on size but can be overridden with `level`.

{{slot:sizes-example}}

```typescript
GovUKHeading({ text: 'Extra large heading', size: 'xl' })
GovUKHeading({ text: 'Large heading', size: 'l' })
GovUKHeading({ text: 'Medium heading', size: 'm' })
GovUKHeading({ text: 'Small heading', size: 's' })
```

| Size | Font size | Default level |
|---|---|---|
| `'xl'` | 48px | `<h1>` |
| `'l'` | 36px | `<h1>` |
| `'m'` | 24px | `<h2>` |
| `'s'` | 19px bold | `<h3>` |

---

## Caption

Add a caption above the heading for context.

{{slot:caption-example}}

```typescript
GovUKHeading({
  text: 'Personal details',
  size: 'l',
  caption: 'Section 1 of 4',
})
```

---

## Custom level

Override the default heading level when the visual size does not
match the document hierarchy.

```typescript
GovUKHeading({ text: 'Section title', size: 'l', level: 2 })
```

---

## Dynamic content

```typescript
GovUKHeading({ text: Data('caseName'), size: 'l' })
```
