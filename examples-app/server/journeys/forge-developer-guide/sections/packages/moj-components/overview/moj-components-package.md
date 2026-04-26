---
title: MOJ Components
section: packages
path: packages/moj-components/overview
teaches: [moj-components-package]
prerequisites: [packages, block]
---

<p class="govuk-caption-xl">Packages</p>

# MOJ Components
The MOJ Components package provides pre-built blocks for the
Ministry of Justice Design System. These complement the GOV.UK
components with patterns specific to MOJ services.

{{slot:toc}}

---

## Entry point

```typescript
import {
  MOJAlert,
  MOJBadge,
  MOJBanner,
  MOJButtonMenu,
  MOJCard,
  MOJCardGroup,
  MOJDatePicker,
  MOJFilter,
  MOJMessages,
  MOJMultiSelect,
  MOJProgressBar,
  MOJSideNavigation,
  MOJSortableTable,
  MOJSubNavigation,
  MOJTicketPanel,
  MOJTimeline,
} from '@ministryofjustice/hmpps-forge/moj-components'
```

---

## What is included

The package currently provides:

- **Messages and status** - alert, badge, banner, messages, progress
  bar, ticket panel, and timeline
- **Navigation** - side navigation and sub navigation
- **Actions and layout** - button menu, card, and card group
- **Forms and lists** - date picker, filter, multi-select, and
  sortable table

Each component accepts the same properties as the corresponding MOJ
Design System pattern, translated into Forge's declarative block
format. Properties that accept static values also accept Forge
expressions (`Answer()`, `Data()`, conditionals, etc.), making them
reactive to user input and loaded data.
