---
title: Radios
section: packages
path: packages/govuk-components/radio-input
teaches: [govuk::RADIO_INPUT, radio-input, govuk-radio-input, conditional-reveal, visibleWhen]
prerequisites: [govuk-components-package, block, validation]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Radios

A set of radio buttons that let the user select a single option from
a list. The component renders the GOV.UK Design System radios pattern
and supports hints, dividers, conditional reveals, inline layout, and
validation.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::RADIO_INPUT` from the GOV.UK components package. Every
radio group needs a `code`, a `fieldset` with a legend, and an
`items` array.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::RADIO_INPUT.build(obj! {
    "code": "contactMethod",
    "fieldset": obj! {
        "legend": obj! { "text": "How would you prefer to be contacted?" },
    },
    "items": [
        obj! { "value": "email", "text": "Email" },
        obj! { "value": "phone", "text": "Phone" },
        obj! { "value": "post", "text": "Post" },
    ],
})
```

---

## Fieldset and legend

Radios are always wrapped in a fieldset with a legend. Use the
`fieldset` property to configure it. When the radio group is the
only question on the page, set `"isPageHeading": true` to wrap the
legend in an `<h1>`.

```rust
govuk::RADIO_INPUT.build(obj! {
    "code": "visitType",
    "fieldset": obj! {
        "legend": obj! {
            "text": "How would you like to meet?",
            "classes": classes::fieldset::LARGE_LABEL,
            "isPageHeading": true,
        },
    },
    "items": [
        obj! { "value": "in-person", "text": "In person" },
        obj! { "value": "video", "text": "Video call" },
        obj! { "value": "phone", "text": "Phone call" },
    ],
})
```

Legend size classes:

| Class | Size |
|---|---|
| `classes::fieldset::EXTRA_LARGE_LABEL` | 48px |
| `classes::fieldset::LARGE_LABEL` | 36px |
| `classes::fieldset::MEDIUM_LABEL` | 24px |
| `classes::fieldset::SMALL_LABEL` | Bold, standard size |

---

## Hints

Add a hint below the legend to give extra guidance. Each individual
item can also have its own hint.

```rust
govuk::RADIO_INPUT.build(obj! {
    "code": "contactMethod",
    "fieldset": obj! {
        "legend": obj! { "text": "How would you prefer to be contacted?" },
    },
    "hint": "Select one option.",
    "items": [
        obj! {
            "value": "email",
            "text": "Email",
            "hint": "We will respond within 24 hours",
        },
        obj! { "value": "phone", "text": "Phone" },
        obj! { "value": "post", "text": "Post", "hint": "Allow 5 to 7 working days" },
    ],
})
```

---

## Inline layout

For short lists of two or three options, display them horizontally
with `classes::radios::INLINE`.

{{slot:inline-example}}

```rust
govuk::RADIO_INPUT.build(obj! {
    "code": "hasPassport",
    "fieldset": obj! {
        "legend": obj! { "text": "Do you have a passport?" },
    },
    "classes": classes::radios::INLINE,
    "items": [obj! { "value": "yes", "text": "Yes" }, obj! { "value": "no", "text": "No" }],
})
```

---

## Dividers

Insert a divider between items to separate a less common option.
The GOV.UK convention is to use the word "or".

{{slot:divider-example}}

```rust
govuk::RADIO_INPUT.build(obj! {
    "code": "country",
    "fieldset": obj! {
        "legend": obj! { "text": "Where do you live?" },
    },
    "items": [
        obj! { "value": "england", "text": "England" },
        obj! { "value": "scotland", "text": "Scotland" },
        obj! { "value": "wales", "text": "Wales" },
        obj! { "value": "northern-ireland", "text": "Northern Ireland" },
        obj! { "divider": "or" },
        obj! { "value": "abroad", "text": "I live abroad" },
    ],
})
```

---

## Conditional items

Use `visibleWhen` on an item or divider to omit it from rendering.
This only controls presentation. It does not clear or reject a
previously stored answer; use `dependentWhen`, validation, or a hook
when the answer itself should no longer apply.

```rust
govuk::RADIO_INPUT.build(obj! {
    "code": "contactMethod",
    "fieldset": obj! {
        "legend": obj! { "text": "How would you prefer to be contacted?" },
    },
    "items": [
        obj! { "value": "email", "text": "Email" },
        obj! {
            "value": "phone",
            "text": "Phone",
            "visibleWhen": data("phoneContactEnabled"),
        },
        obj! { "divider": "or", "visibleWhen": data("showPostalOption") },
        obj! {
            "value": "post",
            "text": "Post",
            "visibleWhen": data("showPostalOption"),
        },
    ],
})
```

---

## Conditional reveals

Show extra fields when a specific option is selected using the
`block` property on an item. The revealed content appears below
the selected radio.

Pair `block` with `dependentWhen` on the nested field so that
validation is skipped and the value is cleared when the parent
option is not selected.

{{slot:reveal-example}}

```rust
govuk::RADIO_INPUT.build(obj! {
    "code": "heardFrom",
    "fieldset": obj! {
        "legend": obj! { "text": "How did you hear about us?" },
    },
    "items": [
        obj! { "value": "search-engine", "text": "Search engine" },
        obj! {
            "value": "social-media",
            "text": "Social media",
            "block": govuk::TEXT_INPUT.build(obj! {
                "code": "socialMediaPlatform",
                "label": "Which platform?",
                "dependentWhen": answer("heardFrom").matches(condition::equals("social-media")),
                "classes": classes::input::WIDTH_20,
                "validWhen": [
                    validation(obj! {
                        "condition": self_().matches(condition::is_required()),
                        "message": "Enter the platform where you saw us",
                    }),
                ],
            }),
        },
        obj! { "value": "friend", "text": "Friend or colleague" },
        obj! {
            "value": "other",
            "text": "Other",
            "block": govuk::TEXT_INPUT.build(obj! {
                "code": "otherSource",
                "label": "Please specify",
                "dependentWhen": answer("heardFrom").matches(condition::equals("other")),
                "classes": classes::input::WIDTH_20,
                "validWhen": [
                    validation(obj! {
                        "condition": self_().matches(condition::is_required()),
                        "message": "Enter where you heard about us",
                    }),
                ],
            }),
        },
    ],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select how you heard about us",
        }),
    ],
})
```

---

## Validation

Use `validWhen` to require a selection. The error message appears
above the fieldset.

```rust
govuk::RADIO_INPUT.build(obj! {
    "code": "contactMethod",
    "fieldset": obj! {
        "legend": obj! { "text": "How would you prefer to be contacted?" },
    },
    "items": [
        obj! { "value": "email", "text": "Email" },
        obj! { "value": "phone", "text": "Phone" },
        obj! { "value": "post", "text": "Post" },
    ],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select how you would prefer to be contacted",
        }),
    ],
})
```

---

## Conditional visibility

Control when the entire radio group appears using `visibleWhen`.

```rust
govuk::RADIO_INPUT.build(obj! {
    "code": "preferredDay",
    "fieldset": obj! {
        "legend": obj! { "text": "Which day works best?" },
    },
    "visibleWhen": answer("visitType").matches(condition::equals("in-person")),
    "items": [
        obj! { "value": "monday", "text": "Monday" },
        obj! { "value": "wednesday", "text": "Wednesday" },
        obj! { "value": "friday", "text": "Friday" },
    ],
})
```

---

## Practical examples

### Single question page

{{slot:single-question-example}}

```rust
govuk::RADIO_INPUT.build(obj! {
    "code": "visitType",
    "fieldset": obj! {
        "legend": obj! {
            "text": "How would you like to meet?",
            "classes": classes::fieldset::LARGE_LABEL,
            "isPageHeading": true,
        },
    },
    "hint": "Pick the option that works best for you.",
    "items": [
        obj! { "value": "in-person", "text": "In person" },
        obj! { "value": "video", "text": "Video call" },
        obj! { "value": "phone", "text": "Phone call" },
    ],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select how you would like to meet",
        }),
    ],
})
```
