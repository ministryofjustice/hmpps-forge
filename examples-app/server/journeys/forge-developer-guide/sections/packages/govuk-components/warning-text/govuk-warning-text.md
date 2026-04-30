---
title: Warning Text
section: packages
path: packages/govuk-components/warning-text
teaches: [GovUKWarningText, warning-text, govuk-warning-text]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Warning text

A prominent warning message with an exclamation mark icon. Use it for
important information that the user needs to be aware of, such as
legal consequences or irreversible actions. The component renders the
GOV.UK Design System warning text pattern.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKWarningText` from the GOV.UK components package. Provide
`text`, `html`, or `blocks` as content.

```typescript
import { GovUKWarningText } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKWarningText({
  text: 'You can be fined up to £5,000 if you do not register.',
})
```

---

## Type interface

{{slot:interface}}

---

## HTML content

Use `html` when you need links or formatting within the warning.

{{slot:html-example}}

```typescript
GovUKWarningText({
  html: 'You must <a class="govuk-link" href="/complete">complete your return</a> by 31 January.',
})
```

---

## With child blocks

Use `blocks` when the warning content is built from another Forge
block. Blocks take precedence over `text` and `html`.

{{slot:blocks-example}}

```typescript
GovUKWarningText({
  blocks: [
    HtmlBlock({ tag: 'span', content: 'You must confirm this action before continuing.' }),
  ],
})
```

---

## Screen reader text

The component includes a visually hidden "Warning" prefix for screen
readers. Override it with `iconFallbackText` if you need different
wording.

```typescript
GovUKWarningText({
  text: 'This action cannot be undone.',
  iconFallbackText: 'Important',
})
```

---

## Conditional visibility

Show the warning only when a condition is met.

```typescript
GovUKWarningText({
  text: 'Your session will expire in 5 minutes.',
  visibleWhen: Data('sessionExpiringSoon').match(Condition.Equals(true)),
})
```
