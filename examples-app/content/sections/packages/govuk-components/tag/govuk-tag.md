---
title: Tag
section: packages
path: packages/govuk-components/tag
teaches: [govuk::TAG, tag, govuk-tag, classes::tag]
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

Import `govuk::TAG` from the GOV.UK components package.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::TAG.build(obj! { "text": "Completed" })
```

---

## Colours

Use `GovUKUtilityClasses.Tag` to apply colour variants.

{{slot:colours-example}}

```rust
govuk::TAG.build(obj! { "text": "Completed", "classes": classes::tag::GREEN })
govuk::TAG.build(obj! { "text": "In progress", "classes": classes::tag::BLUE })
govuk::TAG.build(obj! { "text": "Not started", "classes": classes::tag::GREY })
govuk::TAG.build(obj! { "text": "Overdue", "classes": classes::tag::RED })
```

All available colours:

| Class | Colour |
|---|---|
| `classes::tag::BLUE` | Blue |
| `classes::tag::GREEN` | Green |
| `classes::tag::GREY` | Grey |
| `classes::tag::RED` | Red |
| `classes::tag::ORANGE` | Orange |
| `classes::tag::YELLOW` | Yellow |
| `classes::tag::PURPLE` | Purple |
| `classes::tag::TEAL` | Teal |
| `classes::tag::MAGENTA` | Magenta |

---

## Dynamic text and colour

Use expressions for dynamic status tags.

```rust
govuk::TAG.build(obj! {
    "text": when(answer("status").matches(condition::equals("complete"))).then("Completed").otherwise("In progress"),
    "classes": when(answer("status").matches(condition::equals("complete"))).then(classes::tag::GREEN).otherwise(classes::tag::BLUE),
})
```
