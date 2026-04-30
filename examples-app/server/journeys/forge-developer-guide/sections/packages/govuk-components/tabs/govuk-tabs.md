---
title: Tabs
section: packages
path: packages/govuk-components/tabs
teaches: [GovUKTabs, tabs, govuk-tabs, visibleWhen]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Tabs

A set of tabbed content panels that lets users switch between
related sections of content. The component renders the GOV.UK Design
System tabs pattern.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKTabs` from the GOV.UK components package. Every tab
group needs a unique `id` and an `items` array. Each item has an
`id`, a `label` (the tab text), and `panel` content.

```typescript
import { GovUKTabs } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKTabs({
  id: 'cases',
  items: [
    {
      id: 'active',
      label: 'Active',
      panel: { text: 'These are your active cases.' },
    },
    {
      id: 'closed',
      label: 'Closed',
      panel: { text: 'These are your closed cases.' },
    },
  ],
})
```

---

## Type interface

{{slot:interface}}

---

## HTML content

Use `panel.html` for rich content inside a tab.

{{slot:html-example}}

```typescript
GovUKTabs({
  id: 'schedule',
  items: [
    {
      id: 'monday',
      label: 'Monday',
      panel: { html: '<h2 class="govuk-heading-m">Monday</h2><p class="govuk-body">9am to 5pm</p>' },
    },
    {
      id: 'tuesday',
      label: 'Tuesday',
      panel: { html: '<h2 class="govuk-heading-m">Tuesday</h2><p class="govuk-body">10am to 4pm</p>' },
    },
    {
      id: 'wednesday',
      label: 'Wednesday',
      panel: { html: '<h2 class="govuk-heading-m">Wednesday</h2><p class="govuk-body">9am to 5pm</p>' },
    },
  ],
})
```

---

## With child blocks

Use `panel.blocks` to render Forge blocks inside a tab panel.

```typescript
{
  id: 'summary',
  label: 'Summary',
  panel: {
    blocks: [
      GovUKHeading({ text: 'Case summary', size: 'm' }),
      GovUKBody({ text: 'This case was opened on 15 March 2024.' }),
    ],
  },
}
```

---

## Conditional tabs

Use `visibleWhen` on a tab item to omit the tab and its panel from
rendering.

```typescript
GovUKTabs({
  id: 'case-tabs',
  items: [
    {
      id: 'overview',
      label: 'Overview',
      panel: { text: 'Case overview' },
    },
    {
      id: 'admin',
      label: 'Admin',
      panel: { text: 'Admin-only details' },
      visibleWhen: Session('role').match(Condition.Equals('admin')),
    },
  ],
})
```

---

## Custom title

The default title is "Contents". Override it with the `title`
property.

```typescript
GovUKTabs({
  id: 'schedule',
  title: 'Schedule',
  items: [/* ... */],
})
```
