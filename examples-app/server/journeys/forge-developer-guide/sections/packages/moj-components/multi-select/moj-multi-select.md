---
title: Multi Select
section: packages
path: packages/moj-components/multi-select
teaches: [MOJMultiSelect, multi-select, moj-multi-select]
prerequisites: [moj-components-package, block]
---

<p class="govuk-caption-xl">MOJ Components</p>

# Multi select

A multi-select table lets users select multiple rows. It renders a
GOV.UK table with the MOJ multi-select JavaScript enhancement enabled.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `MOJMultiSelect` from the MOJ components package.

```typescript
import { MOJMultiSelect } from '@ministryofjustice/hmpps-forge/moj-components'

MOJMultiSelect({
  head: [
    { html: '<input type="checkbox" class="govuk-checkboxes__input" id="select-all">' },
    { text: 'Name' },
    { text: 'Status' },
  ],
  rows: [
    [
      { html: '<input type="checkbox" class="govuk-checkboxes__input" name="selected" value="1">' },
      { text: 'John Smith' },
      { text: 'Active' },
    ],
  ],
})
```

---

## Table caption

Use a caption to describe what the selectable rows represent.

{{slot:caption-example}}

```typescript
MOJMultiSelect({
  caption: 'People to allocate',
  captionClasses: 'govuk-table__caption--m',
  head: [
    { html: '<input type="checkbox" class="govuk-checkboxes__input" id="select-people">' },
    { text: 'Name' },
    { text: 'Status' },
  ],
  rows: [
    [
      { html: '<input type="checkbox" class="govuk-checkboxes__input" name="people" value="1">' },
      { text: 'John Smith' },
      { text: 'Active' },
    ],
  ],
})
```

---

## Checkbox cells

The first column should contain checkbox inputs. The header checkbox is
used by the JavaScript enhancement to select or deselect all rows.
