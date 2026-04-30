---
title: Table
section: packages
path: packages/govuk-components/table
teaches: [GovUKTable, table, govuk-table]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Table

A data table for displaying tabular information. The component
renders the GOV.UK Design System table and supports headers,
captions, row header cells, and dynamic data.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKTable` from the GOV.UK components package. The `rows`
property is an array of row arrays, where each cell has a `text` or
`html` property.

```typescript
import { GovUKTable } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKTable({
  rows: [
    [{ text: 'January' }, { text: '£85' }],
    [{ text: 'February' }, { text: '£165' }],
    [{ text: 'March' }, { text: '£230' }],
  ],
})
```

---

## Type interface

{{slot:interface}}

---

## Headers

Add column headers with the `head` property.

{{slot:header-example}}

```typescript
GovUKTable({
  head: [{ text: 'Month' }, { text: 'Amount' }],
  rows: [
    [{ text: 'January' }, { text: '£85' }],
    [{ text: 'February' }, { text: '£165' }],
    [{ text: 'March' }, { text: '£230' }],
  ],
})
```

---

## Caption

Add a visible caption above the table to describe its contents. Use
`captionClasses` to control the size.

{{slot:caption-example}}

```typescript
GovUKTable({
  caption: 'Monthly expenses',
  captionClasses: 'govuk-table__caption--m',
  head: [{ text: 'Month' }, { text: 'Amount' }],
  rows: [
    [{ text: 'January' }, { text: '£85' }],
    [{ text: 'February' }, { text: '£165' }],
    [{ text: 'March' }, { text: '£230' }],
  ],
})
```

---

## Row headers

Set `firstCellIsHeader: true` to render the first cell of each row
as a `<th>` element. Use this when the first column identifies the
row.

```typescript
GovUKTable({
  firstCellIsHeader: true,
  head: [{ text: 'Name' }, { text: 'Role' }, { text: 'Status' }],
  rows: [
    [{ text: 'Sarah' }, { text: 'Caseworker' }, { text: 'Active' }],
    [{ text: 'James' }, { text: 'Manager' }, { text: 'Active' }],
  ],
})
```

---

## Numeric columns

Right-align numeric columns using the `format` property on header
and body cells.

```typescript
head: [
  { text: 'Month' },
  { text: 'Amount', format: 'numeric' },
]
rows: [
  [{ text: 'January' }, { text: '£85', format: 'numeric' }],
]
```
