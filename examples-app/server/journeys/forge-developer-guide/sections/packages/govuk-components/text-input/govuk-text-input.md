---
title: Text Input
section: packages
path: packages/govuk-components/text-input
teaches: [GovUKTextInput, text-input, govuk-text-input]
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

Import `GovUKTextInput` from the GOV.UK components package and add it
to your step's blocks array. Every text input needs a `code` (the key
the answer is stored under) and a `label`.

```typescript
import { GovUKTextInput } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKTextInput({
  code: 'fullName',
  label: 'Full name',
})
```

---

## Type interface

{{slot:interface}}

---

## Label

The label can be a plain string or an object with additional options.
Use `isPageHeading: true` when the input is the only question on the
page - this wraps the label in an `<h1>` element.

```typescript
GovUKTextInput({
  code: 'fullName',
  label: {
    text: 'What is your full name?',
    classes: GovUKUtilityClasses.Label.Large,
    isPageHeading: true,
  },
})
```

Label size classes control visual weight:

| Class | Size |
|---|---|
| `GovUKUtilityClasses.Label.ExtraLarge` | 48px - page-level heading |
| `GovUKUtilityClasses.Label.Large` | 36px - section heading |
| `GovUKUtilityClasses.Label.Medium` | 24px - sub-section heading |
| `GovUKUtilityClasses.Label.Small` | Bold, standard size |

---

## Hint

Add guidance below the label with the `hint` property. Like labels,
hints accept a plain string or an object.

```typescript
GovUKTextInput({
  code: 'niNumber',
  label: 'National Insurance number',
  hint: 'It is on your National Insurance card. For example, QQ 12 34 56 C.',
})
```

---

## Input width

Set the width of the input using `GovUKUtilityClasses.Input` classes.
The width roughly matches the number of characters that fit at standard
font size. Choose a width that reflects the expected length of the answer.

```typescript
GovUKTextInput({
  code: 'postcode',
  label: 'Postcode',
  classes: GovUKUtilityClasses.Input.Width5,
})
```

| Class | Fits roughly |
|---|---|
| `GovUKUtilityClasses.Input.Width2` | 2 characters (day, age) |
| `GovUKUtilityClasses.Input.Width3` | 3 characters (area code) |
| `GovUKUtilityClasses.Input.Width4` | 4 characters (year, PIN) |
| `GovUKUtilityClasses.Input.Width5` | 5 characters (postcode) |
| `GovUKUtilityClasses.Input.Width10` | 10 characters (phone number) |
| `GovUKUtilityClasses.Input.Width20` | 20 characters (name, email) |
| `GovUKUtilityClasses.Input.Width30` | 30 characters (address line) |

Use `GovUKUtilityClasses.Input.ExtraLetterSpacing` for reference numbers
and codes where extra spacing improves readability.

---

## Input type

Set `inputType` to tell the browser what kind of data to expect. This
controls built-in browser behaviour such as virtual keyboard layout on
mobile devices.

```typescript
GovUKTextInput({
  code: 'email',
  label: 'Email address',
  inputType: 'email',
})
```

| Type | Use for |
|---|---|
| `'text'` | General text (default) |
| `'email'` | Email addresses |
| `'tel'` | Phone numbers |
| `'url'` | Web addresses |
| `'number'` | Numeric values |
| `'password'` | Passwords (masks input) |

You can also set `inputMode` independently to control the virtual
keyboard without changing the input type:

```typescript
GovUKTextInput({
  code: 'accountNumber',
  label: 'Account number',
  inputMode: 'numeric',
  pattern: '[0-9]*',
  classes: GovUKUtilityClasses.Input.Width10,
})
```

---

## Autocomplete

Set `autocomplete` to help browsers fill in answers automatically. This
improves the experience for users who have saved their details.

```typescript
GovUKTextInput({
  code: 'givenName',
  label: 'First name',
  autocomplete: 'given-name',
})
```

Common values: `'name'`, `'given-name'`, `'family-name'`, `'email'`,
`'tel'`, `'address-line1'`, `'address-line2'`, `'address-level2'`
(town), `'postal-code'`.

---

## Additional descriptions

Use `describedBy` to add extra element IDs to the input's
`aria-describedby` attribute. This is useful when another element on
the page provides guidance that should be announced by screen readers.

```typescript
GovUKTextInput({
  code: 'email',
  label: 'Email address',
  describedBy: 'email-guidance',
})
```

---

## Prefix and suffix

Add a prefix or suffix to provide context - for example, a currency
symbol or unit.

```typescript
GovUKTextInput({
  code: 'cost',
  label: 'Cost, in pounds',
  prefix: { text: '£' },
  classes: GovUKUtilityClasses.Input.Width5,
  inputMode: 'numeric',
})

GovUKTextInput({
  code: 'weight',
  label: 'Weight, in kilograms',
  suffix: { text: 'kg' },
  classes: GovUKUtilityClasses.Input.Width4,
  inputMode: 'numeric',
})
```

---

## Validation

Use the `validWhen` property to add validation rules. Validators run on
form submission and display an error message above the input when a
condition is not met.

```typescript
import { validation, Self } from '@ministryofjustice/hmpps-forge/core/authoring'
import { Condition } from '@ministryofjustice/hmpps-forge/core/authoring'

GovUKTextInput({
  code: 'fullName',
  label: 'Full name',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your full name',
    }),
    validation({
      condition: Self().match(Condition.String.HasMaxLength(100)),
      message: 'Full name must be 100 characters or less',
    }),
  ],
})
```

---

## Formatting

Use `formatters` to transform the submitted value before it is stored.
A common use is trimming whitespace.

```typescript
import { Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

GovUKTextInput({
  code: 'email',
  label: 'Email address',
  inputType: 'email',
  formatters: [Transformer.String.Trim()],
})
```

---

## Conditional visibility

Control when the input appears using `visibleWhen`. The field is hidden
from the page and excluded from validation when the condition is false.

```typescript
import { Answer } from '@ministryofjustice/hmpps-forge/core/authoring'

GovUKTextInput({
  code: 'otherReason',
  label: 'Please specify',
  visibleWhen: Answer('reason').match(Condition.Equals('other')),
})
```

---

## Spellcheck

Disable spellcheck for fields where the browser's spelling suggestions
are unhelpful, such as email addresses or reference numbers.

```typescript
GovUKTextInput({
  code: 'email',
  label: 'Email address',
  inputType: 'email',
  spellcheck: false,
})
```

---

## Practical examples

### Single question page

When a text input is the only question on a page, make the label the
page heading:

{{slot:single-question-example}}

```typescript
GovUKTextInput({
  code: 'fullName',
  label: {
    text: 'What is your full name?',
    classes: GovUKUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  autocomplete: 'name',
  classes: GovUKUtilityClasses.Input.Width20,
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your full name',
    }),
  ],
})
```

### Postcode field

{{slot:postcode-example}}

```typescript
GovUKTextInput({
  code: 'postcode',
  label: 'Postcode',
  hint: 'For example, SW1A 1AA',
  autocomplete: 'postal-code',
  classes: GovUKUtilityClasses.Input.Width10,
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a postcode',
    }),
    validation({
      condition: Self().match(Condition.Address.IsValidPostcode()),
      message: 'Enter a valid postcode',
    }),
  ],
})
```

### Currency input

{{slot:currency-example}}

```typescript
GovUKTextInput({
  code: 'annualIncome',
  label: 'Annual income before tax',
  hint: 'Round to the nearest pound',
  prefix: { text: '£' },
  inputMode: 'numeric',
  classes: GovUKUtilityClasses.Input.Width10,
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your annual income',
    }),
    validation({
      condition: Self().match(Condition.Number.IsPositive()),
      message: 'Annual income must be a positive number',
    }),
  ],
})
```

### Reference number with extra spacing

{{slot:reference-example}}

```typescript
GovUKTextInput({
  code: 'reference',
  label: 'Case reference number',
  hint: 'This is on the letter we sent you. For example, HDJ2123F.',
  classes: `${GovUKUtilityClasses.Input.Width10} ${GovUKUtilityClasses.Input.ExtraLetterSpacing}`,
  spellcheck: false,
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a case reference number',
    }),
  ],
})
```
