---
title: Checkboxes
section: packages
path: packages/govuk-components/checkbox-input
teaches: [govuk::CHECKBOX_INPUT, checkbox-input, govuk-checkbox-input, exclusive-checkbox, visibleWhen]
prerequisites: [govuk-components-package, block, validation]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Checkboxes

A set of checkboxes that let the user select one or more options from
a list. The component renders the GOV.UK Design System checkboxes
pattern and supports hints, dividers, conditional reveals, exclusive
behaviour, and validation.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::CHECKBOX_INPUT` from the GOV.UK components package. Every
checkbox group needs a `code`, an `items` array, and a legend - set
through `fieldset.legend`, or the `label` property as a shorthand.

The field value is always an array of the selected items' values.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::CHECKBOX_INPUT.build(obj! {
    "code": "contactMethods",
    "fieldset": obj! {
        "legend": obj! { "text": "How would you like to be contacted?" },
    },
    "hint": "Select all that apply.",
    "items": [
        obj! { "value": "email", "text": "Email" },
        obj! { "value": "phone", "text": "Phone" },
        obj! { "value": "post", "text": "Post" },
    ],
})
```

---

## Fieldset and legend

Checkboxes render inside a fieldset with a legend. The legend comes
from `fieldset.legend`, or from `label` when no fieldset is given.
When the checkbox group is the only question on the page, set
`"isPageHeading": true` to wrap the legend in an `<h1>`.

```rust
govuk::CHECKBOX_INPUT.build(obj! {
    "code": "countriesVisited",
    "fieldset": obj! {
        "legend": obj! {
            "text": "Which countries have you visited?",
            "classes": classes::fieldset::LARGE_LABEL,
            "isPageHeading": true,
        },
    },
    "hint": "Select all that apply.",
    "items": [
        obj! { "value": "uk", "text": "United Kingdom" },
        obj! { "value": "france", "text": "France" },
        obj! { "value": "germany", "text": "Germany" },
    ],
})
```

---

## Hints

Add a hint below the legend with the `hint` property. Each individual
item can also have its own hint.

```rust
govuk::CHECKBOX_INPUT.build(obj! {
    "code": "contactMethods",
    "fieldset": obj! {
        "legend": obj! { "text": "How would you like to be contacted?" },
    },
    "hint": "Select all that apply.",
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

## Additional descriptions

Use `describedBy` to add extra element IDs to the checkbox group's
`aria-describedby` attribute. With the usual fieldset wrapper, this
describes the fieldset. If you set `fieldset.describedBy`, GOV.UK
Frontend uses that value instead.

```rust
govuk::CHECKBOX_INPUT.build(obj! {
    "code": "contactMethods",
    "fieldset": obj! {
        "legend": obj! { "text": "How would you like to be contacted?" },
    },
    "describedBy": "contact-methods-guidance",
    "items": [
        obj! { "value": "email", "text": "Email" },
        obj! { "value": "phone", "text": "Phone" },
    ],
})
```

---

## Exclusive behaviour

Add a "none of the above" option using `"behaviour": "exclusive"`.
When the exclusive checkbox is selected, all other checkboxes are
unchecked. When any other checkbox is selected, the exclusive
checkbox is unchecked.

{{slot:exclusive-example}}

```rust
govuk::CHECKBOX_INPUT.build(obj! {
    "code": "contactMethods",
    "fieldset": obj! {
        "legend": obj! { "text": "How would you like to be contacted?" },
    },
    "hint": "Select all that apply.",
    "items": [
        obj! { "value": "email", "text": "Email" },
        obj! { "value": "phone", "text": "Phone" },
        obj! { "value": "post", "text": "Post" },
        obj! { "divider": "or" },
        obj! {
            "value": "none",
            "text": "I do not want to be contacted",
            "behaviour": "exclusive",
        },
    ],
})
```

---

## Dividers

Insert a divider between items to visually separate a less common
option. The GOV.UK convention is to use the word "or", typically
paired with an exclusive checkbox.

```rust
"items": [
    obj! { "value": "email", "text": "Email" },
    obj! { "value": "phone", "text": "Phone" },
    obj! { "divider": "or" },
    obj! { "value": "none", "text": "None of the above", "behaviour": "exclusive" },
],
```

---

## Conditional items

Use `visibleWhen` on an item or divider to omit it from rendering.
This only controls presentation. It does not clear or reject a
previously stored answer; use `dependentWhen`, validation, or a hook
when the answer itself should no longer apply.

```rust
govuk::CHECKBOX_INPUT.build(obj! {
    "code": "contactMethods",
    "fieldset": obj! {
        "legend": obj! { "text": "How would you like to be contacted?" },
    },
    "items": [
        obj! { "value": "email", "text": "Email" },
        obj! {
            "value": "sms",
            "text": "Text message",
            "visibleWhen": data("smsContactEnabled"),
        },
        obj! { "divider": "or", "visibleWhen": data("showNoContactOption") },
        obj! {
            "value": "none",
            "text": "I do not want to be contacted",
            "behaviour": "exclusive",
        },
    ],
})
```

---

## Conditional reveals

Show extra fields when a specific checkbox is selected using the
`block` property on an item. Pair with `dependentWhen` on the
nested field so validation is skipped and the value is cleared when
the parent option is not selected.

{{slot:reveal-example}}

```rust
govuk::CHECKBOX_INPUT.build(obj! {
    "code": "notifications",
    "fieldset": obj! {
        "legend": obj! { "text": "How should we notify you?" },
    },
    "items": [
        obj! {
            "value": "email",
            "text": "Email",
            "block": govuk::TEXT_INPUT.build(obj! {
                "code": "notificationEmail",
                "label": "Email address",
                "inputType": "email",
                "dependentWhen": answer("notifications").matches(condition::array::contains("email")),
                "validWhen": [
                    validation(obj! {
                        "condition": self_().matches(condition::is_required()),
                        "message": "Enter an email address",
                    }),
                ],
            }),
        },
        obj! {
            "value": "sms",
            "text": "Text message",
            "block": govuk::TEXT_INPUT.build(obj! {
                "code": "notificationPhone",
                "label": "Phone number",
                "inputType": "tel",
                "dependentWhen": answer("notifications").matches(condition::array::contains("sms")),
                "validWhen": [
                    validation(obj! {
                        "condition": self_().matches(condition::is_required()),
                        "message": "Enter a phone number",
                    }),
                ],
            }),
        },
    ],
})
```

Note: because checkboxes produce an array, use
`condition::array::contains()` for `dependentWhen` rather than
`condition::equals()`.

---

## Small checkboxes

Use `classes::checkboxes::SMALL` for a more compact layout
when the options are secondary or there are many of them.

```rust
govuk::CHECKBOX_INPUT.build(obj! {
    "code": "filters",
    "fieldset": obj! {
        "legend": obj! { "text": "Filter by status" },
    },
    "classes": classes::checkboxes::SMALL,
    "items": [
        obj! { "value": "active", "text": "Active" },
        obj! { "value": "pending", "text": "Pending" },
        obj! { "value": "closed", "text": "Closed" },
    ],
})
```

---

## Validation

Use `validWhen` to require at least one selection. Since the field
value is an array, `condition::is_required()` returns false for an
empty array.

```rust
govuk::CHECKBOX_INPUT.build(obj! {
    "code": "terms",
    "fieldset": obj! {
        "legend": obj! { "text": "Terms and conditions" },
    },
    "items": [obj! { "value": "agreed", "text": "I agree to the terms and conditions" }],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "You must agree to the terms and conditions",
        }),
    ],
})
```

---

## Practical examples

### Single question page

{{slot:single-question-example}}

```rust
govuk::CHECKBOX_INPUT.build(obj! {
    "code": "countriesVisited",
    "fieldset": obj! {
        "legend": obj! {
            "text": "Which countries have you visited?",
            "classes": classes::fieldset::LARGE_LABEL,
            "isPageHeading": true,
        },
    },
    "hint": "Select all that apply.",
    "items": [
        obj! { "value": "uk", "text": "United Kingdom" },
        obj! { "value": "france", "text": "France" },
        obj! { "value": "germany", "text": "Germany" },
        obj! { "value": "spain", "text": "Spain" },
        obj! { "divider": "or" },
        obj! {
            "value": "none",
            "text": "I have not visited any of these",
            "behaviour": "exclusive",
        },
    ],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Select which countries you have visited, or select that you have not visited any",
        }),
    ],
})
```
