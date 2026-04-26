---
title: Classes
section: packages
path: packages/govuk-components/utility-classes
teaches: [GovUKUtilityClasses, utility-classes, govuk-utility-classes]
prerequisites: [govuk-components-package]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Utility classes

A collection of GOV.UK Design System CSS class constants. Use these
in the `classes` property on components instead of writing class
strings by hand.

```typescript
import { GovUKUtilityClasses } from '@ministryofjustice/hmpps-forge/govuk-components'
```

{{slot:toc}}

---

## Input widths

Control the width of text inputs to match the expected length of
the answer.

| Constant | CSS class | Fits roughly |
|---|---|---|
| `GovUKUtilityClasses.Input.Width2` | `govuk-input--width-2` | 2 characters |
| `GovUKUtilityClasses.Input.Width3` | `govuk-input--width-3` | 3 characters |
| `GovUKUtilityClasses.Input.Width4` | `govuk-input--width-4` | 4 characters |
| `GovUKUtilityClasses.Input.Width5` | `govuk-input--width-5` | 5 characters |
| `GovUKUtilityClasses.Input.Width10` | `govuk-input--width-10` | 10 characters |
| `GovUKUtilityClasses.Input.Width20` | `govuk-input--width-20` | 20 characters |
| `GovUKUtilityClasses.Input.Width30` | `govuk-input--width-30` | 30 characters |
| `GovUKUtilityClasses.Input.ExtraLetterSpacing` | `govuk-input--extra-letter-spacing` | Reference numbers |

### Label sizes

| Constant | CSS class | Size |
|---|---|---|
| `GovUKUtilityClasses.Label.ExtraLarge` | `govuk-label--xl` | 48px |
| `GovUKUtilityClasses.Label.Large` | `govuk-label--l` | 36px |
| `GovUKUtilityClasses.Label.Medium` | `govuk-label--m` | 24px |
| `GovUKUtilityClasses.Label.Small` | `govuk-label--s` | Bold, standard |

### Fieldset legend sizes

| Constant | CSS class | Size |
|---|---|---|
| `GovUKUtilityClasses.Fieldset.ExtraLargeLabel` | `govuk-fieldset__legend--xl` | 48px |
| `GovUKUtilityClasses.Fieldset.LargeLabel` | `govuk-fieldset__legend--l` | 36px |
| `GovUKUtilityClasses.Fieldset.MediumLabel` | `govuk-fieldset__legend--m` | 24px |
| `GovUKUtilityClasses.Fieldset.SmallLabel` | `govuk-fieldset__legend--s` | Bold, standard |

### Radios and checkboxes

| Constant | CSS class | Effect |
|---|---|---|
| `GovUKUtilityClasses.Radios.Inline` | `govuk-radios--inline` | Horizontal layout |
| `GovUKUtilityClasses.Radios.Small` | `govuk-radios--small` | Compact size |
| `GovUKUtilityClasses.Checkboxes.Small` | `govuk-checkboxes--small` | Compact size |

### Tag colours

| Constant | CSS class |
|---|---|
| `GovUKUtilityClasses.Tag.Blue` | `govuk-tag--blue` |
| `GovUKUtilityClasses.Tag.Green` | `govuk-tag--green` |
| `GovUKUtilityClasses.Tag.Grey` | `govuk-tag--grey` |
| `GovUKUtilityClasses.Tag.Red` | `govuk-tag--red` |
| `GovUKUtilityClasses.Tag.Orange` | `govuk-tag--orange` |
| `GovUKUtilityClasses.Tag.Yellow` | `govuk-tag--yellow` |
| `GovUKUtilityClasses.Tag.Purple` | `govuk-tag--purple` |
| `GovUKUtilityClasses.Tag.Teal` | `govuk-tag--teal` |
| `GovUKUtilityClasses.Tag.Magenta` | `govuk-tag--magenta` |

---

## Accessibility

| Constant | CSS class |
|---|---|
| `GovUKUtilityClasses.VisuallyHidden` | `govuk-visually-hidden` |
| `GovUKUtilityClasses.VisuallyHiddenFocusable` | `govuk-visually-hidden-focusable` |

`VisuallyHidden` hides content visually while keeping it accessible
to screen readers. `VisuallyHiddenFocusable` does the same but
becomes visible when focused, useful for skip links.

---

## Width overrides

Responsive width classes. Full width on mobile, the specified
fraction on tablet and above.

| Constant | CSS class | Width |
|---|---|---|
| `GovUKUtilityClasses.Width.Full` | `govuk-!-width-full` | 100% |
| `GovUKUtilityClasses.Width.ThreeQuarters` | `govuk-!-width-three-quarters` | 75% |
| `GovUKUtilityClasses.Width.TwoThirds` | `govuk-!-width-two-thirds` | 66% |
| `GovUKUtilityClasses.Width.OneHalf` | `govuk-!-width-one-half` | 50% |
| `GovUKUtilityClasses.Width.OneThird` | `govuk-!-width-one-third` | 33% |
| `GovUKUtilityClasses.Width.OneQuarter` | `govuk-!-width-one-quarter` | 25% |

---

## Display

| Constant | CSS class |
|---|---|
| `GovUKUtilityClasses.Display.Inline` | `govuk-!-display-inline` |
| `GovUKUtilityClasses.Display.InlineBlock` | `govuk-!-display-inline-block` |
| `GovUKUtilityClasses.Display.Block` | `govuk-!-display-block` |
| `GovUKUtilityClasses.Display.None` | `govuk-!-display-none` |
| `GovUKUtilityClasses.Display.NonePrint` | `govuk-!-display-none-print` |

---

## Font size

Responsive font size overrides.

| Constant | CSS class | Size |
|---|---|---|
| `GovUKUtilityClasses.FontSize.Size16` | `govuk-!-font-size-16` | 16px |
| `GovUKUtilityClasses.FontSize.Size19` | `govuk-!-font-size-19` | 19px |
| `GovUKUtilityClasses.FontSize.Size24` | `govuk-!-font-size-24` | 24px |
| `GovUKUtilityClasses.FontSize.Size27` | `govuk-!-font-size-27` | 27px |
| `GovUKUtilityClasses.FontSize.Size36` | `govuk-!-font-size-36` | 36px |
| `GovUKUtilityClasses.FontSize.Size48` | `govuk-!-font-size-48` | 48px |
| `GovUKUtilityClasses.FontSize.Size80` | `govuk-!-font-size-80` | 80px |

---

## Font weight

| Constant | CSS class |
|---|---|
| `GovUKUtilityClasses.FontWeight.Regular` | `govuk-!-font-weight-regular` |
| `GovUKUtilityClasses.FontWeight.Bold` | `govuk-!-font-weight-bold` |

---

## Text alignment

| Constant | CSS class |
|---|---|
| `GovUKUtilityClasses.TextAlign.Left` | `govuk-!-text-align-left` |
| `GovUKUtilityClasses.TextAlign.Centre` | `govuk-!-text-align-centre` |
| `GovUKUtilityClasses.TextAlign.Right` | `govuk-!-text-align-right` |

---

## Margin

Responsive margin overrides on a scale of 0 to 9. Values 4 to 9
are smaller on mobile.

| Scale | Size |
|---|---|
| 0 | 0 |
| 1 | 5px |
| 2 | 10px |
| 3 | 15px |
| 4 | 20px |
| 5 | 25px |
| 6 | 30px |
| 7 | 40px |
| 8 | 50px |
| 9 | 60px |

Constants follow the pattern `GovUKUtilityClasses.Margin.<Side><Scale>`.

| Prefix | Sides |
|---|---|
| `All` | All four sides |
| `Top` | Top only |
| `Right` | Right only |
| `Bottom` | Bottom only |
| `Left` | Left only |

```typescript
GovUKUtilityClasses.Margin.Bottom6  // govuk-!-margin-bottom-6 (30px)
GovUKUtilityClasses.Margin.Top0     // govuk-!-margin-top-0 (remove top margin)
GovUKUtilityClasses.Margin.All4     // govuk-!-margin-4 (20px all sides)
```

---

## Padding

Same scale and pattern as margin.

```typescript
GovUKUtilityClasses.Padding.All3     // govuk-!-padding-3 (15px all sides)
GovUKUtilityClasses.Padding.Top6     // govuk-!-padding-top-6 (30px)
GovUKUtilityClasses.Padding.Left0    // govuk-!-padding-left-0 (remove left padding)
```
