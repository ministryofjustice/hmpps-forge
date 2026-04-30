---
title: Timeline
section: packages
path: packages/moj-components/timeline
teaches: [MOJTimeline, timeline, moj-timeline]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Timeline

A timeline displays a chronological history of events. It is useful
for case history, decisions, messages, and other records where users
need to understand what happened and when.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `MOJTimeline` from the MOJ components package.

```typescript
import { MOJTimeline } from '@ministryofjustice/hmpps-forge/moj-components'

MOJTimeline({
  items: [
    {
      label: { text: 'Application approved' },
      text: 'The visit request was approved.',
      datetime: { timestamp: '2026-04-24T14:30:00.000Z', type: 'datetime' },
      byline: { text: 'Caseworker 1' },
    },
  ],
})
```

---

## Type interface

{{slot:interface}}

---

## Multiple events

Items are displayed in the order you provide, usually with the most
recent event first.

{{slot:events-example}}

```typescript
MOJTimeline({
  headingLevel: 3,
  items: [
    {
      label: { text: 'Application approved' },
      text: 'The visit request was approved.',
      datetime: { timestamp: '2026-04-24T14:30:00.000Z', type: 'datetime' },
      byline: { text: 'Caseworker 1' },
    },
    {
      label: { text: 'Application submitted' },
      html: '<p>The visitor submitted the request online.</p>',
      datetime: { timestamp: '2026-04-23T09:15:00.000Z', type: 'datetime' },
      byline: { text: 'Visitor' },
    },
  ],
})
```

---

## With child blocks

Use item `blocks` when a timeline event description should be
composed from Forge blocks. Blocks take precedence over item `text`
and `html`.

{{slot:blocks-example}}

```typescript
MOJTimeline({
  items: [
    {
      label: { text: 'Application submitted' },
      blocks: [
        GovUKBody({ text: 'The visitor submitted the request online.', classes: 'govuk-!-margin-bottom-0' }),
      ],
      datetime: { timestamp: '2026-04-23T09:15:00.000Z', type: 'datetime' },
      byline: { text: 'Visitor' },
    },
  ],
})
```

---

## Conditional events

Use `visibleWhen` when an event should only appear for some users or
journey states.

```typescript
MOJTimeline({
  items: [
    {
      label: { text: 'Security check completed' },
      text: 'The security check passed.',
      visibleWhen: Data('securityCheckComplete'),
    },
  ],
})
```
