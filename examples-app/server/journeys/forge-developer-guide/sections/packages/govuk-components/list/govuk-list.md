---
title: List
section: packages
path: packages/govuk-components/list
teaches: [GovUKList, list, govuk-list]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# List

A list of items rendered as a bullet list, numbered list, or plain
list. The component renders GOV.UK Design System list styles and
supports dynamic items from data.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKList` from the GOV.UK components package. The `items`
property accepts an array of strings or child blocks, or a data source
that resolves to one.

```typescript
import { GovUKList } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKList({
  items: ['First item', 'Second item', 'Third item'],
  style: 'bullet',
})
```

---

## List types

### Bullet list

{{slot:bullet-example}}

```typescript
GovUKList({
  items: ['Design', 'Build', 'Test'],
  style: 'bullet',
})
```

### Numbered list

{{slot:numbered-example}}

```typescript
GovUKList({
  items: ['Check eligibility', 'Gather documents', 'Submit application'],
  style: 'number',
})
```

### Plain list

Omit `style` for a plain list with no markers.

```typescript
GovUKList({
  items: ['support@example.com', '0800 123 4567'],
})
```

---

## Spaced list

Set `spaced: true` to add extra vertical spacing between items.

```typescript
GovUKList({
  items: ['First item', 'Second item', 'Third item'],
  style: 'bullet',
  spaced: true,
})
```

---

## Block items

Items can be child blocks instead of strings - or a mix of the two. Each block renders
inside its own `<li>`.

{{slot:block-items-example}}

```typescript
GovUKList({
  items: [
    'A plain string item',
    GovUKBody({ text: 'A paragraph item' }),
    HtmlBlock({ tag: 'a', attributes: { href: '/help' }, content: 'A link item' }),
  ],
  style: 'bullet',
})
```

---

## Dynamic items

Use `Data()` to render items from loaded data.

```typescript
GovUKList({
  items: Data('errorMessages'),
  style: 'bullet',
})
```
