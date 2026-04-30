---
title: Section Break
section: packages
path: packages/govuk-components/section-break
teaches: [GovUKSectionBreak, section-break, govuk-section-break]
prerequisites: [govuk-components-package, block]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Section break

A horizontal rule or spacing element used to separate sections of
content. The component renders the GOV.UK Design System section
break.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKSectionBreak` from the GOV.UK components package.

```typescript
import { GovUKSectionBreak } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKSectionBreak({ size: 'l', visible: true })
```

---

## Type interface

{{slot:interface}}

---

## Sizes

The `size` property controls the amount of vertical spacing.

{{slot:sizes-example}}

```typescript
GovUKSectionBreak({ size: 'xl', visible: true })
GovUKSectionBreak({ size: 'l', visible: true })
GovUKSectionBreak({ size: 'm', visible: true })
GovUKSectionBreak({ visible: true })
```

| Size | Spacing |
|---|---|
| `'xl'` | 60px |
| `'l'` | 30px |
| `'m'` | 20px |
| _(omitted)_ | Default spacing |

---

## Invisible spacing

Omit `visible` or set it to `false` to add vertical spacing without
a horizontal rule.

```typescript
GovUKSectionBreak({ size: 'l' })
```
