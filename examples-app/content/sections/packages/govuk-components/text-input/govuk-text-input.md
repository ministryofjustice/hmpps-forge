---
title: Text Input
section: packages
path: packages/govuk-components/text-input
teaches: [govuk::TEXT_INPUT, text-input, govuk-text-input]
prerequisites: [govuk-components-package, block, validation]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Text input

A single-line text input field. It renders the GOV.UK Design System
text input component and supports validation, formatting, prefix and
suffix decorations, autocomplete hints, and conditional visibility.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `govuk::TEXT_INPUT` from the GOV.UK components package and add it
to your step's blocks array. Every text input needs a `code` (the key
the answer is stored under) and a `label`.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::TEXT_INPUT.build(obj! {
    "code": "fullName",
    "label": "Full name",
})
```

---

## Label

The label can be a plain string or an object with additional options.
Use `"isPageHeading": true` when the input is the only question on the
page - this wraps the label in an `<h1>` element.

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "fullName",
    "label": obj! {
        "text": "What is your full name?",
        "classes": classes::label::LARGE,
        "isPageHeading": true,
    },
})
```

Label size classes control visual weight:

| Class | Size |
|---|---|
| `classes::label::EXTRA_LARGE` | 48px - page-level heading |
| `classes::label::LARGE` | 36px - section heading |
| `classes::label::MEDIUM` | 24px - sub-section heading |
| `classes::label::SMALL` | Bold, standard size |

---

## Hint

Add guidance below the label with the `hint` property. Like labels,
hints accept a plain string or an object.

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "niNumber",
    "label": "National Insurance number",
    "hint": "It is on your National Insurance card. For example, QQ 12 34 56 C.",
})
```

---

## Input width

Set the width of the input using `GovUKUtilityClasses.Input` classes.
The width roughly matches the number of characters that fit at standard
font size. Choose a width that reflects the expected length of the answer.

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "postcode",
    "label": "Postcode",
    "classes": classes::input::WIDTH_5,
})
```

| Class | Fits roughly |
|---|---|
| `classes::input::WIDTH_2` | 2 characters (day, age) |
| `classes::input::WIDTH_3` | 3 characters (area code) |
| `classes::input::WIDTH_4` | 4 characters (year, PIN) |
| `classes::input::WIDTH_5` | 5 characters (postcode) |
| `classes::input::WIDTH_10` | 10 characters (phone number) |
| `classes::input::WIDTH_20` | 20 characters (name, email) |
| `classes::input::WIDTH_30` | 30 characters (address line) |

Use `classes::input::EXTRA_LETTER_SPACING` for reference numbers
and codes where extra spacing improves readability.

---

## Input type

Set `inputType` to tell the browser what kind of data to expect. This
controls built-in browser behaviour such as virtual keyboard layout on
mobile devices.

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "email",
    "label": "Email address",
    "inputType": "email",
})
```

| Type | Use for |
|---|---|
| `"text"` | General text (default) |
| `"email"` | Email addresses |
| `"tel"` | Phone numbers |
| `"url"` | Web addresses |
| `"number"` | Numeric values |
| `"password"` | Passwords (masks input) |

You can also set `inputMode` independently to control the virtual
keyboard without changing the input type:

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "accountNumber",
    "label": "Account number",
    "inputMode": "numeric",
    "pattern": "[0-9]*",
    "classes": classes::input::WIDTH_10,
})
```

---

## Autocomplete

Set `autocomplete` to help browsers fill in answers automatically. This
improves the experience for users who have saved their details.

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "givenName",
    "label": "First name",
    "autocomplete": "given-name",
})
```

Common values: `"name"`, `"given-name"`, `"family-name"`, `"email"`,
`"tel"`, `"address-line1"`, `"address-line2"`, `"address-level2"`
(town), `"postal-code"`.

---

## Additional descriptions

Use `describedBy` to add extra element IDs to the input's
`aria-describedby` attribute. This is useful when another element on
the page provides guidance that should be announced by screen readers.

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "email",
    "label": "Email address",
    "describedBy": "email-guidance",
})
```

---

## Prefix and suffix

Add a prefix or suffix to provide context - for example, a currency
symbol or unit.

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "cost",
    "label": "Cost, in pounds",
    "prefix": obj! { "text": "£" },
    "classes": classes::input::WIDTH_5,
    "inputMode": "numeric",
})
govuk::TEXT_INPUT.build(obj! {
    "code": "weight",
    "label": "Weight, in kilograms",
    "suffix": obj! { "text": "kg" },
    "classes": classes::input::WIDTH_4,
    "inputMode": "numeric",
})
```

---

## Validation

Use the `validWhen` property to add validation rules. Validators run on
form submission and display an error message above the input when a
condition is not met.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::TEXT_INPUT.build(obj! {
    "code": "fullName",
    "label": "Full name",
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter your full name",
        }),
        validation(obj! {
            "condition": self_().matches(condition::string::has_max_length(100)),
            "message": "Full name must be 100 characters or less",
        }),
    ],
})
```

---

## Formatting

Use `formatters` to transform the submitted value before it is stored.
A common use is trimming whitespace.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::TEXT_INPUT.build(obj! {
    "code": "email",
    "label": "Email address",
    "inputType": "email",
    "formatters": [transformer::string::trim()],
})
```

---

## Conditional visibility

Control when the input appears using `visibleWhen`. The field is hidden
from the page when the condition is false. To also skip validation and
clear the stored answer, add a matching `dependentWhen` condition.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

govuk::TEXT_INPUT.build(obj! {
    "code": "otherReason",
    "label": "Please specify",
    "visibleWhen": answer("reason").matches(condition::equals("other")),
})
```

---

## Spellcheck

Disable spellcheck for fields where the browser's spelling suggestions
are unhelpful, such as email addresses or reference numbers.

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "email",
    "label": "Email address",
    "inputType": "email",
    "spellcheck": false,
})
```

---

## Practical examples

### Single question page

When a text input is the only question on a page, make the label the
page heading:

{{slot:single-question-example}}

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "fullName",
    "label": obj! {
        "text": "What is your full name?",
        "classes": classes::label::LARGE,
        "isPageHeading": true,
    },
    "autocomplete": "name",
    "classes": classes::input::WIDTH_20,
    "formatters": [transformer::string::trim()],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter your full name",
        }),
    ],
})
```

### Postcode field

{{slot:postcode-example}}

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "postcode",
    "label": "Postcode",
    "hint": "For example, SW1A 1AA",
    "autocomplete": "postal-code",
    "classes": classes::input::WIDTH_10,
    "formatters": [transformer::string::trim()],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a postcode",
        }),
        validation(obj! {
            "condition": self_().matches(condition::address::is_valid_postcode()),
            "message": "Enter a valid postcode",
        }),
    ],
})
```

### Currency input

{{slot:currency-example}}

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "annualIncome",
    "label": "Annual income before tax",
    "hint": "Round to the nearest pound",
    "prefix": obj! { "text": "£" },
    "inputMode": "numeric",
    "classes": classes::input::WIDTH_10,
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter your annual income",
        }),
        validation(obj! {
            "condition": self_().matches(condition::string::digits_only()),
            "message": "Annual income must be a whole number, like 25000",
        }),
    ],
})
```

### Reference number with extra spacing

{{slot:reference-example}}

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "reference",
    "label": "Case reference number",
    "hint": "This is on the letter we sent you. For example, HDJ2123F.",
    "classes": format!("{} {}", classes::input::WIDTH_10, classes::input::EXTRA_LETTER_SPACING),
    "spellcheck": false,
    "formatters": [transformer::string::trim()],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a case reference number",
        }),
    ],
})
```
