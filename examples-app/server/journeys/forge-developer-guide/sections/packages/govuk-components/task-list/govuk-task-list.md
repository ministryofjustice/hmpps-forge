---
title: Task List
section: packages
path: packages/govuk-components/task-list
teaches: [GovUKTaskList, task-list, govuk-task-list]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Task list

A list of tasks with status indicators. The component renders the
GOV.UK Design System task list and supports links, hints, status
tags, and conditional visibility.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKTaskList` from the GOV.UK components package. Each
item has a `title` and a `status`.

```typescript
import { GovUKTaskList } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKTaskList({
  items: [
    {
      title: { text: 'Personal details' },
      status: { text: 'Completed' },
    },
    {
      title: { text: 'Contact information' },
      status: { text: 'In progress' },
    },
    {
      title: { text: 'Upload documents' },
      status: { text: 'Not yet started' },
    },
  ],
})
```

---

## Type interface

{{slot:interface}}

---

## Linked tasks

Add `href` to make a task title a clickable link.

{{slot:linked-example}}

```typescript
GovUKTaskList({
  items: [
    {
      title: { text: 'Personal details' },
      href: '/personal-details',
      status: { tag: { text: 'Completed', classes: 'govuk-tag--blue' } },
    },
    {
      title: { text: 'Contact information' },
      href: '/contact',
      status: { tag: { text: 'Incomplete', classes: 'govuk-tag--grey' } },
    },
  ],
})
```

---

## Status tags

Use `status.tag` instead of `status.text` to render a coloured tag.

```typescript
status: {
  tag: {
    text: 'Completed',
    classes: 'govuk-tag--green',
  },
}
```

---

## Hints

Add hints below the task title for additional context.

```typescript
{
  title: { text: 'Your details' },
  hint: { text: 'Your name and relationship to the prisoner' },
  href: '/your-details',
  status: { tag: { text: 'Not started', classes: 'govuk-tag--grey' } },
}
```

---

## Conditional tasks

Use `visibleWhen` to show tasks only when prerequisites are met.

```typescript
{
  title: { text: 'Submit application' },
  visibleWhen: and(
    Data('personalDetailsComplete').match(Condition.Equals(true)),
    Data('contactComplete').match(Condition.Equals(true)),
  ),
  status: { text: 'Cannot start yet' },
}
```
