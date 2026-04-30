---
title: Grid Row
section: packages
path: packages/govuk-components/grid-row
teaches: [GovUKGridRow, grid-row, govuk-grid-row]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Grid row

A responsive grid layout with configurable columns. The component
renders the GOV.UK Design System grid system and supports all
standard column widths. Child blocks are placed inside each column.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKGridRow` from the GOV.UK components package. Each
column has a `width` and an array of `blocks`.

```typescript
import { GovUKGridRow } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKGridRow({
  columns: [
    {
      width: 'one-half',
      blocks: [GovUKBody({ text: 'Left column' })],
    },
    {
      width: 'one-half',
      blocks: [GovUKBody({ text: 'Right column' })],
    },
  ],
})
```

---

## Type interface

{{slot:interface}}

---

## Column widths

{{slot:widths-example}}

| Width | Fraction |
|---|---|
| `'full'` | 100% |
| `'three-quarters'` | 75% |
| `'two-thirds'` | 66% |
| `'one-half'` | 50% |
| `'one-third'` | 33% |
| `'one-quarter'` | 25% |
| `'one-sixth'` | 16% |

```typescript
GovUKGridRow({
  columns: [
    {
      width: 'two-thirds',
      blocks: [GovUKBody({ text: 'Main content area' })],
    },
    {
      width: 'one-third',
      blocks: [GovUKBody({ text: 'Sidebar' })],
    },
  ],
})
```

---

## Three column layout

```typescript
GovUKGridRow({
  columns: [
    { width: 'one-third', blocks: [GovUKBody({ text: 'Column 1' })] },
    { width: 'one-third', blocks: [GovUKBody({ text: 'Column 2' })] },
    { width: 'one-third', blocks: [GovUKBody({ text: 'Column 3' })] },
  ],
})
```
