---
title: GOV.UK Components
section: packages
path: packages/govuk-components/overview
teaches: [govuk-components-package]
prerequisites: [packages, block]
---

<p class="govuk-caption-xl">Packages</p>

# GOV.UK Components
The GOV.UK Components package provides pre-built blocks for the
GOV.UK Design System. Each block maps to a Design System component
and produces accessible, standards-compliant HTML.

{{slot:toc}}

---

## Entry point

```typescript
import {
  GovUKTextInput,
  GovUKTextareaInput,
  GovUKRadioInput,
  GovUKCheckboxInput,
  GovUKSelectInput,
  GovUKDateInputFull,
  GovUKButton,
  GovUKLinkButton,
  GovUKPanel,
  GovUKSummaryList,
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKInsetText,
  GovUKWarningText,
  GovUKDetails,
  GovUKNotificationBanner,
  GovUKTag,
  GovUKTable,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'
```

---

## What is included

The package covers form inputs, content blocks, and layout
components from the GOV.UK Design System:

- **Form inputs** - text input, password input, textarea, character
  count, radios, checkboxes, select, date input (full, year-month,
  and month-day variants)
- **Buttons** - standard button, link-styled button
- **Navigation** - back link, breadcrumbs, pagination, exit this
  page
- **Content** - heading, body text, list, inset text, warning text,
  details (disclosure), notification banner, panel, accordion, tabs
- **Data display** - summary list, table, tag, task list
- **Layout** - button group, grid row, section break
- **Utilities** - `GovUKUtilityClasses` provides common class
  constants for sizing and spacing, `GovUKValidations` provides
  pre-built validation rule sets such as
  `GovUKValidations.DateInputFull()`

Each component accepts the same properties as the corresponding
GOV.UK Nunjucks macro, translated into Forge's declarative block
format. Properties that accept static values also accept Forge
expressions (`Answer()`, `Data()`, conditionals, etc.), making
them reactive to user input and loaded data.
