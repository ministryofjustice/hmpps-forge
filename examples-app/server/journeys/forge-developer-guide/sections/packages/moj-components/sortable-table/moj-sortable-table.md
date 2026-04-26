---
title: Sortable Table
section: packages
path: packages/moj-components/sortable-table
teaches: [MOJSortableTable, sortable-table, moj-sortable-table]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Sortable table

A sortable table renders a GOV.UK table with the MOJ sortable table
JavaScript enhancement enabled. Users can sort rows by clicking column
headers.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `MOJSortableTable` from the MOJ components package.

```typescript
import { MOJSortableTable } from '@ministryofjustice/hmpps-forge/moj-components'

MOJSortableTable({
  head: [
    { html: '<button>Name</button>' },
    { html: '<button>Date</button>' },
    { html: '<button>Status</button>' },
  ],
  rows: [
    [{ text: 'John Smith' }, { text: '2026-04-24' }, { text: 'Active' }],
    [{ text: 'Jane Doe' }, { text: '2026-04-25' }, { text: 'Pending' }],
  ],
})
```

---

## Captions

Use `caption` and `captionClasses` to describe the table.

{{slot:caption-example}}

```typescript
MOJSortableTable({
  caption: 'Appointments',
  captionClasses: 'govuk-table__caption--m',
  head: [
    { html: '<button>Name</button>' },
    { html: '<button>Date</button>' },
    { html: '<button>Status</button>' },
  ],
  rows: [
    [{ text: 'John Smith' }, { text: '2026-04-24' }, { text: 'Active' }],
  ],
})
```

---

## Header buttons

Header cells should contain button elements so the JavaScript
enhancement can make each sortable column keyboard accessible.
