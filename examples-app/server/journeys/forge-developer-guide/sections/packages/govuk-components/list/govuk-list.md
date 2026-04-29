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
property accepts a data source that resolves to an array of strings.

```typescript
import { GovUKList } from '@ministryofjustice/hmpps-forge/govuk-components'
import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'

GovUKList({
  items: Literal(['First item', 'Second item', 'Third item']),
  type: 'bullet',
})
```

---

## List types

### Bullet list

{{slot:bullet-example}}

```typescript
GovUKList({
  items: Literal(['Design', 'Build', 'Test']),
  type: 'bullet',
})
```

### Numbered list

{{slot:numbered-example}}

```typescript
GovUKList({
  items: Literal(['Check eligibility', 'Gather documents', 'Submit application']),
  type: 'number',
})
```

### Plain list

Omit `type` for a plain list with no markers.

```typescript
GovUKList({
  items: Literal(['support@example.com', '0800 123 4567']),
})
```

---

## Spaced list

Set `spaced: true` to add extra vertical spacing between items.

```typescript
GovUKList({
  items: Literal(['First item', 'Second item', 'Third item']),
  type: 'bullet',
  spaced: true,
})
```

---

## Dynamic items

Use `Data()` to render items from loaded data.

```typescript
GovUKList({
  items: Data('errorMessages'),
  type: 'bullet',
})
```
