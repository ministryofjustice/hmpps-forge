---
title: Pagination
section: packages
path: packages/govuk-components/pagination
teaches: [GovUKPagination, pagination, govuk-pagination]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Pagination

Navigation controls for paged content. The component renders the
GOV.UK Design System pagination and supports previous/next links,
numbered page items, and ellipsis gaps.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKPagination` from the GOV.UK components package. Use
`previous` and `next` for simple two-way navigation, or add `items`
for numbered pages.

```typescript
import { GovUKPagination } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKPagination({
  previous: { href: '?page=1' },
  next: { href: '?page=3' },
})
```

---

## Numbered pages

Add `items` for page number links. Set `current: true` on the
active page. Use `ellipsis: true` for gaps in long page lists.

{{slot:numbered-example}}

```typescript
GovUKPagination({
  previous: { href: '?page=1' },
  next: { href: '?page=3' },
  items: [
    { number: '1', href: '?page=1' },
    { number: '2', href: '?page=2', current: true },
    { number: '3', href: '?page=3' },
  ],
})
```

---

## With ellipsis

Use ellipsis items to indicate skipped pages in long lists.

```typescript
items: [
  { number: '1', href: '?page=1' },
  { number: '2', href: '?page=2', current: true },
  { number: '3', href: '?page=3' },
  { ellipsis: true },
  { number: '20', href: '?page=20' },
]
```

---

## Custom link text

Override the default "Previous" and "Next" text, and add a label
for context.

```typescript
GovUKPagination({
  previous: {
    href: '/results/1',
    text: 'Previous',
    labelText: '1 of 3',
  },
  next: {
    href: '/results/3',
    text: 'Next',
    labelText: '3 of 3',
  },
})
```

---

## Conditional visibility

Hide previous or next links when at the first or last page.

```typescript
GovUKPagination({
  previous: {
    href: Format('?page=%1', Data('currentPage').pipe(Transformer.Number.Add(-1))),
    visibleWhen: Data('currentPage').match(Condition.Number.GreaterThan(1)),
  },
  next: {
    href: Format('?page=%1', Data('currentPage').pipe(Transformer.Number.Add(1))),
    visibleWhen: Data('currentPage').match(
      Condition.Number.LessThan(Data('totalPages')),
    ),
  },
})
```
