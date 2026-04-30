---
title: Messages
section: packages
path: packages/moj-components/messages
teaches: [MOJMessages, messages, moj-messages, visibleWhen]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Messages

Messages display a conversation thread with sent and received
messages. Each message includes content, sender information, and a
timestamp.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `MOJMessages` from the MOJ components package.

```typescript
import { MOJMessages } from '@ministryofjustice/hmpps-forge/moj-components'

MOJMessages({
  label: 'Case correspondence',
  items: [
    {
      id: 1,
      text: 'Can you confirm the visit time?',
      type: 'sent',
      sender: 'Caseworker',
      timestamp: '2026-04-24T10:00:00.000Z',
    },
  ],
})
```

---

## Type interface

{{slot:interface}}

---

## Sent and received messages

Use `type: 'sent'` for outgoing messages and `type: 'received'` for
incoming messages.

{{slot:thread-example}}

```typescript
MOJMessages({
  label: 'Case correspondence',
  items: [
    {
      id: 1,
      text: 'Can you confirm the visit time?',
      type: 'sent',
      sender: 'Caseworker',
      timestamp: '2026-04-24T10:00:00.000Z',
    },
    {
      id: 2,
      text: 'The visitor confirmed 2pm.',
      type: 'received',
      sender: 'Visits team',
      timestamp: '2026-04-24T10:15:00.000Z',
    },
  ],
})
```

---

## HTML content

Use `html` when a message needs links or inline formatting.

```typescript
MOJMessages({
  items: [
    {
      html: '<p>See the <a href="#">updated risk assessment</a>.</p>',
      type: 'received',
      sender: 'Risk team',
      timestamp: '2026-04-24T11:00:00.000Z',
    },
  ],
})
```

---

## With child blocks

Use item `blocks` when a message should be composed from Forge
blocks. Blocks take precedence over item `text` and `html`.

{{slot:blocks-example}}

```typescript
MOJMessages({
  items: [
    {
      blocks: [
        GovUKBody({ text: 'See the updated risk assessment.', classes: 'govuk-!-margin-bottom-0' }),
      ],
      type: 'received',
      sender: 'Risk team',
      timestamp: '2026-04-24T11:00:00.000Z',
    },
  ],
})
```

---

## Conditional messages

Use `visibleWhen` on an item to omit a message from rendering.

```typescript
MOJMessages({
  label: 'Case correspondence',
  items: [
    {
      text: 'The visitor confirmed 2pm.',
      type: 'received',
      sender: 'Visits team',
      timestamp: '2026-04-24T10:15:00.000Z',
    },
    {
      text: 'Internal note: security review complete.',
      type: 'received',
      sender: 'Security team',
      timestamp: '2026-04-24T10:30:00.000Z',
      visibleWhen: Session('role').match(Condition.Equals('admin')),
    },
  ],
})
```
