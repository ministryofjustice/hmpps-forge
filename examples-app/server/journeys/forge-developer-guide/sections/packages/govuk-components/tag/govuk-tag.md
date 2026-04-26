---
title: Tag
section: packages
path: packages/govuk-components/tag
teaches: [GovUKTag, tag, govuk-tag, GovUKUtilityClasses.Tag]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Tag

A small coloured label used to indicate status. The component renders
the GOV.UK Design System tag and supports all standard colour
variants.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKTag` from the GOV.UK components package.

```typescript
import { GovUKTag } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKTag({ text: 'Completed' })
```

---

## Colours

Use `GovUKUtilityClasses.Tag` to apply colour variants.

{{slot:colours-example}}

```typescript
GovUKTag({ text: 'Completed', classes: GovUKUtilityClasses.Tag.Green })
GovUKTag({ text: 'In progress', classes: GovUKUtilityClasses.Tag.Blue })
GovUKTag({ text: 'Not started', classes: GovUKUtilityClasses.Tag.Grey })
GovUKTag({ text: 'Overdue', classes: GovUKUtilityClasses.Tag.Red })
```

All available colours:

| Class | Colour |
|---|---|
| `GovUKUtilityClasses.Tag.Blue` | Blue |
| `GovUKUtilityClasses.Tag.Green` | Green |
| `GovUKUtilityClasses.Tag.Grey` | Grey |
| `GovUKUtilityClasses.Tag.Red` | Red |
| `GovUKUtilityClasses.Tag.Orange` | Orange |
| `GovUKUtilityClasses.Tag.Yellow` | Yellow |
| `GovUKUtilityClasses.Tag.Purple` | Purple |
| `GovUKUtilityClasses.Tag.Teal` | Teal |
| `GovUKUtilityClasses.Tag.Magenta` | Magenta |

---

## Dynamic text and colour

Use expressions for dynamic status tags.

```typescript
GovUKTag({
  text: when(
    Answer('status').match(Condition.Equals('complete')),
    'Completed',
    'In progress',
  ),
  classes: when(
    Answer('status').match(Condition.Equals('complete')),
    GovUKUtilityClasses.Tag.Green,
    GovUKUtilityClasses.Tag.Blue,
  ),
})
```
