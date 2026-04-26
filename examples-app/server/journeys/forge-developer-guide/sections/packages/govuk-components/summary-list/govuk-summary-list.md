---
title: Summary List
section: packages
path: packages/govuk-components/summary-list
teaches: [GovUKSummaryList, summary-list, govuk-summary-list]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Summary list

A list of key-value pairs used to display information. The component
renders the GOV.UK Design System summary list and supports action
links, conditional rows, summary cards, and dynamic content.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKSummaryList` from the GOV.UK components package. Each
row has a `key` and a `value`, and optionally an `actions` list.

```typescript
import { GovUKSummaryList } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKSummaryList({
  rows: [
    { key: { text: 'Name' }, value: { text: 'Sarah Philips' } },
    { key: { text: 'Date of birth' }, value: { text: '5 January 1978' } },
    { key: { text: 'Address' }, value: { text: '72 Guild Street, London, SE23 6FH' } },
  ],
})
```

---

## Action links

Add a `Change` or other action link to each row. Use
`visuallyHiddenText` to make the link accessible - screen readers
will announce "Change name" rather than just "Change".

{{slot:actions-example}}

```typescript
GovUKSummaryList({
  rows: [
    {
      key: { text: 'Name' },
      value: { text: 'Sarah Philips' },
      actions: {
        items: [
          { href: '/change-name', text: 'Change', visuallyHiddenText: 'name' },
        ],
      },
    },
    {
      key: { text: 'Date of birth' },
      value: { text: '5 January 1978' },
      actions: {
        items: [
          { href: '/change-dob', text: 'Change', visuallyHiddenText: 'date of birth' },
        ],
      },
    },
  ],
})
```

---

## Summary card

Wrap the summary list in a card with a title and optional header
actions using the `card` property.

{{slot:card-example}}

```typescript
GovUKSummaryList({
  card: {
    title: { text: 'Personal details' },
    actions: {
      items: [
        { href: '/delete', text: 'Delete', classes: 'govuk-link--destructive' },
      ],
    },
  },
  rows: [
    { key: { text: 'Name' }, value: { text: 'Sarah Philips' } },
    { key: { text: 'Email' }, value: { text: 'sarah@example.com' } },
  ],
})
```

---

## Dynamic values

Use `Answer()`, `Data()`, or other expressions for dynamic content.

```typescript
GovUKSummaryList({
  rows: [
    { key: { text: 'Full name' }, value: { text: Answer('fullName') } },
    { key: { text: 'Email' }, value: { text: Answer('email') } },
    {
      key: { text: 'Date of birth' },
      value: {
        text: Answer('dateOfBirth').pipe(
          Transformer.String.ToDate(),
          Transformer.Date.Format('D MMMM YYYY'),
        ),
      },
    },
  ],
})
```

---

## Conditional rows

Use `visibleWhen` on a row to show it only when a condition is met.

```typescript
{
  key: { text: 'Phone number' },
  value: { text: Answer('phone') },
  visibleWhen: Answer('contactMethod').match(Condition.Equals('phone')),
}
```
