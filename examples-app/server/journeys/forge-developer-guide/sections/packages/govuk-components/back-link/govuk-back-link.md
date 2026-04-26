---
title: Back Link
section: packages
path: packages/govuk-components/back-link
teaches: [GovUKBackLink, back-link, govuk-back-link]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Back link

A link that takes the user to the previous page. The component
renders the GOV.UK Design System back link.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKBackLink` from the GOV.UK components package. The
`href` property is required.

```typescript
import { GovUKBackLink } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKBackLink({ href: '/previous-page' })
```

The default text is "Back". Override it with the `text` property.

---

## Custom text

```typescript
GovUKBackLink({
  href: '/cases',
  text: 'Back to cases',
})
```

---

## Dynamic href

Use expressions for dynamic back links.

```typescript
GovUKBackLink({
  href: Format('/cases/%1', Params('caseId')),
  text: 'Back to case',
})
```
