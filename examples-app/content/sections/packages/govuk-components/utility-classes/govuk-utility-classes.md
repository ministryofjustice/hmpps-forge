---
title: Classes
section: packages
path: packages/govuk-components/utility-classes
teaches: [classes, utility-classes, govuk-utility-classes]
prerequisites: [govuk-components-package]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Utility classes

A collection of GOV.UK Design System CSS class constants. Use these
in the `classes` property on components instead of writing class
strings by hand.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

{{slot:toc}}

---

## Input widths

Control the width of text inputs to match the expected length of
the answer.

| Constant | CSS class | Fits roughly |
|---|---|---|
| `classes::input::WIDTH_2` | `govuk-input--width-2` | 2 characters |
| `classes::input::WIDTH_3` | `govuk-input--width-3` | 3 characters |
| `classes::input::WIDTH_4` | `govuk-input--width-4` | 4 characters |
| `classes::input::WIDTH_5` | `govuk-input--width-5` | 5 characters |
| `classes::input::WIDTH_10` | `govuk-input--width-10` | 10 characters |
| `classes::input::WIDTH_20` | `govuk-input--width-20` | 20 characters |
| `classes::input::WIDTH_30` | `govuk-input--width-30` | 30 characters |
| `classes::input::EXTRA_LETTER_SPACING` | `govuk-input--extra-letter-spacing` | Reference numbers |

### Label sizes

| Constant | CSS class | Size |
|---|---|---|
| `classes::label::EXTRA_LARGE` | `govuk-label--xl` | 48px |
| `classes::label::LARGE` | `govuk-label--l` | 36px |
| `classes::label::MEDIUM` | `govuk-label--m` | 24px |
| `classes::label::SMALL` | `govuk-label--s` | Bold, standard |

### Fieldset legend sizes

| Constant | CSS class | Size |
|---|---|---|
| `classes::fieldset::EXTRA_LARGE_LABEL` | `govuk-fieldset__legend--xl` | 48px |
| `classes::fieldset::LARGE_LABEL` | `govuk-fieldset__legend--l` | 36px |
| `classes::fieldset::MEDIUM_LABEL` | `govuk-fieldset__legend--m` | 24px |
| `classes::fieldset::SMALL_LABEL` | `govuk-fieldset__legend--s` | Bold, standard |

### Radios and checkboxes

| Constant | CSS class | Effect |
|---|---|---|
| `classes::radios::INLINE` | `govuk-radios--inline` | Horizontal layout |
| `classes::radios::SMALL` | `govuk-radios--small` | Compact size |
| `classes::checkboxes::SMALL` | `govuk-checkboxes--small` | Compact size |

### Tag colours

| Constant | CSS class |
|---|---|
| `classes::tag::BLUE` | `govuk-tag--blue` |
| `classes::tag::GREEN` | `govuk-tag--green` |
| `classes::tag::GREY` | `govuk-tag--grey` |
| `classes::tag::RED` | `govuk-tag--red` |
| `classes::tag::ORANGE` | `govuk-tag--orange` |
| `classes::tag::YELLOW` | `govuk-tag--yellow` |
| `classes::tag::PURPLE` | `govuk-tag--purple` |
| `classes::tag::TEAL` | `govuk-tag--teal` |
| `classes::tag::MAGENTA` | `govuk-tag--magenta` |

---

## Accessibility

| Constant | CSS class |
|---|---|
| `classes::VISUALLY_HIDDEN` | `govuk-visually-hidden` |
| `classes::VISUALLY_HIDDEN_FOCUSABLE` | `govuk-visually-hidden-focusable` |

`VisuallyHidden` hides content visually while keeping it accessible
to screen readers. `VisuallyHiddenFocusable` does the same but
becomes visible when focused, useful for skip links.

---

## Width overrides

Responsive width classes. Full width on mobile, the specified
fraction on tablet and above.

| Constant | CSS class | Width |
|---|---|---|
| `classes::width::FULL` | `govuk-!-width-full` | 100% |
| `classes::width::THREE_QUARTERS` | `govuk-!-width-three-quarters` | 75% |
| `classes::width::TWO_THIRDS` | `govuk-!-width-two-thirds` | 66% |
| `classes::width::ONE_HALF` | `govuk-!-width-one-half` | 50% |
| `classes::width::ONE_THIRD` | `govuk-!-width-one-third` | 33% |
| `classes::width::ONE_QUARTER` | `govuk-!-width-one-quarter` | 25% |

---

## Display

| Constant | CSS class |
|---|---|
| `classes::display::INLINE` | `govuk-!-display-inline` |
| `classes::display::INLINE_BLOCK` | `govuk-!-display-inline-block` |
| `classes::display::BLOCK` | `govuk-!-display-block` |
| `classes::display::NONE` | `govuk-!-display-none` |
| `classes::display::NONE_PRINT` | `govuk-!-display-none-print` |

---

## Font size

Responsive font size overrides.

| Constant | CSS class | Size |
|---|---|---|
| `classes::font_size::SIZE_16` | `govuk-!-font-size-16` | 16px |
| `classes::font_size::SIZE_19` | `govuk-!-font-size-19` | 19px |
| `classes::font_size::SIZE_24` | `govuk-!-font-size-24` | 24px |
| `classes::font_size::SIZE_27` | `govuk-!-font-size-27` | 27px |
| `classes::font_size::SIZE_36` | `govuk-!-font-size-36` | 36px |
| `classes::font_size::SIZE_48` | `govuk-!-font-size-48` | 48px |
| `classes::font_size::SIZE_80` | `govuk-!-font-size-80` | 80px |

---

## Font weight

| Constant | CSS class |
|---|---|
| `classes::font_weight::REGULAR` | `govuk-!-font-weight-regular` |
| `classes::font_weight::BOLD` | `govuk-!-font-weight-bold` |

---

## Text alignment

| Constant | CSS class |
|---|---|
| `classes::text_align::LEFT` | `govuk-!-text-align-left` |
| `classes::text_align::CENTRE` | `govuk-!-text-align-centre` |
| `classes::text_align::RIGHT` | `govuk-!-text-align-right` |

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

```rust
classes::margin::BOTTOM_6
// govuk-!-margin-bottom-6 (30px)
classes::margin::TOP_0
// govuk-!-margin-top-0 (remove top margin)
classes::margin::ALL_4
// govuk-!-margin-4 (20px all sides)
```

---

## Padding

Same scale and pattern as margin.

```rust
classes::padding::ALL_3
// govuk-!-padding-3 (15px all sides)
classes::padding::TOP_6
// govuk-!-padding-top-6 (30px)
classes::padding::LEFT_0
// govuk-!-padding-left-0 (remove left padding)
```
