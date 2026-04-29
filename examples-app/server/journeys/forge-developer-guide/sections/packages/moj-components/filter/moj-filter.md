---
title: Filter
section: packages
path: packages/moj-components/filter
teaches: [MOJFilter, filter, moj-filter, visibleWhen]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Filter

A filter displays filter controls and selected filter tags. Use it on
search and list pages where users can narrow a result set.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `MOJFilter` from the MOJ components package.

```typescript
import { MOJFilter } from '@ministryofjustice/hmpps-forge/moj-components'

MOJFilter({
  heading: { text: 'Filter' },
  submit: { text: 'Apply filters' },
  optionsHtml: '<div class="govuk-form-group">...</div>',
})
```

---

## Selected filters

Use `selectedFilters` to show active filters as removable tags.

{{slot:selected-example}}

```typescript
MOJFilter({
  heading: { text: 'Filter' },
  selectedFilters: {
    heading: { text: 'Selected filters' },
    clearLink: { href: '#clear', text: 'Clear filters' },
    categories: [
      {
        heading: { text: 'Status' },
        items: [{ text: 'Open', href: '#remove-open' }],
      },
    ],
  },
  submit: { text: 'Apply filters' },
  optionsHtml: '<div class="govuk-form-group">...</div>',
})
```

---

## Conditional selected filters

Use `visibleWhen` on selected filter categories or individual tag
items to omit them from rendering.

```typescript
MOJFilter({
  heading: { text: 'Filter' },
  selectedFilters: {
    heading: { text: 'Selected filters' },
    clearLink: { href: '#clear', text: 'Clear filters' },
    categories: [
      {
        heading: { text: 'Status' },
        items: [
          { text: 'Open', href: '#remove-open' },
          {
            text: 'Restricted',
            href: '#remove-restricted',
            visibleWhen: Session('role').match(Condition.Equals('admin')),
          },
        ],
      },
      {
        heading: { text: 'Team' },
        visibleWhen: Data('teamFiltersApplied'),
        items: [{ text: 'Visits', href: '#remove-visits' }],
      },
    ],
  },
})
```

---

## Filter controls

`optionsHtml` should contain the form controls for filtering. Keep the
controls short and focused so the panel remains scannable.

```typescript
MOJFilter({
  heading: { text: 'Filter' },
  submit: { text: 'Apply filters' },
  optionsHtml: `
    <div class="govuk-form-group">
      <label class="govuk-label" for="status">Status</label>
      <select class="govuk-select" id="status" name="status">
        <option value="">Any status</option>
        <option value="open">Open</option>
      </select>
    </div>
  `,
})
```
