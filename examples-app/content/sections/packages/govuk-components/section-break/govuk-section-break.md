---
title: Section Break
section: packages
path: packages/govuk-components/section-break
teaches: [govuk::SECTION_BREAK, section-break, govuk-section-break]
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

Import `govuk::SECTION_BREAK` from the GOV.UK components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::SECTION_BREAK.build(obj! { "size": "l", "visible": true })
```

---

## Sizes

The `size` property controls the amount of vertical spacing.

{{slot:sizes-example}}

```rust
govuk::SECTION_BREAK.build(obj! { "size": "xl", "visible": true })
govuk::SECTION_BREAK.build(obj! { "size": "l", "visible": true })
govuk::SECTION_BREAK.build(obj! { "size": "m", "visible": true })
govuk::SECTION_BREAK.build(obj! { "visible": true })
```

| Size | Spacing |
|---|---|
| `"xl"` | 60px |
| `"l"` | 30px |
| `"m"` | 20px |
| _(omitted)_ | Default spacing |

---

## Invisible spacing

Omit `visible` or set it to `false` to add vertical spacing without
a horizontal rule.

```rust
govuk::SECTION_BREAK.build(obj! { "size": "l" })
```
