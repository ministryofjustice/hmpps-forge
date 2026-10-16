---
title: Page Header Actions
section: packages
path: packages/moj-components/page-header-actions
teaches: [MOJPageHeaderActions, page-header-actions, moj-page-header-actions]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Page header actions

Displays a page heading alongside action buttons.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

```typescript
import { MOJPageHeaderActions } from '@ministryofjustice/hmpps-forge/moj-components'

MOJPageHeaderActions({
  heading: 'Cases',
  items: [{ text: 'Add case', href: '#add-case' }],
})
```

---

## Heading levels and conditional actions

{{slot:options-example}}

```typescript
MOJPageHeaderActions({
  heading: { text: 'Case documents', level: 2, classes: 'govuk-heading-l' },
  items: [
    { text: 'Upload document', href: '#upload', classes: 'govuk-button--secondary' },
    { text: 'Restricted action', href: '#restricted', visibleWhen: false },
  ],
})
```

A string heading renders as an `h1`. Use a heading object to set the level, classes, or HTML. The live guide example uses an `h2` to fit the guide page. Actions use MOJ Button menu item options and support `visibleWhen`. Give navigation actions an `href`; buttons without an `href` submit their enclosing form by default.

---

## Reactive values

Use Forge expressions for properties supplied by loaded data.

```typescript
import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'

MOJPageHeaderActions({ heading: Data('pageTitle'), items: [{ text: 'Add case', href: '/cases/new', visibleWhen: Data('canCreateCase') }] })
```

---

## Options

| Property | Purpose |
| --- | --- |
| `heading` | Required heading string or object with text/html, level, and classes. |
| `items` | Buttons or links, including visibleWhen. |
| `classes, attributes` | Additional styling and HTML attributes. |

See the [MOJ Page Header Actions guidance](https://design-patterns.service.justice.gov.uk/components/page-header-actions/) for usage and accessibility advice.
