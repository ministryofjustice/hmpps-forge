# Blocks and Fields

Steps contain blocks and fields. Blocks display content. Fields collect input. Both use the same component system but serve different purposes.

## What are Blocks and Fields?

**Blocks** display content - headings, text, tables, warnings. They don't collect data.

**Fields** collect user input - text boxes, radio buttons, checkboxes, dates. Every field has a `code` that identifies its answer.

### Import

```typescript
import { block, field } from '@ministryofjustice/hmpps-forge/core/authoring'
```

---

## Blocks vs Fields

| Aspect | Block | Field |
|--------|-------|-------|
| Purpose | Display content | Collect input |
| Builder | `block()` | `field()` |
| Has `code` | No | Yes (required) |
| Validation | No | Yes |

---

## Basic Usage

### Using `block()`

```typescript
import { HtmlBlock } from '@ministryofjustice/hmpps-forge/core/components'

HtmlBlock({
  content: '<h1 class="govuk-heading-l">Welcome</h1>',
})
```

### Using `field()`

```typescript
import { validation, Self } from '@ministryofjustice/hmpps-forge/core/authoring'
import { Condition } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKTextInput } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKTextInput({
  code: 'email',
  label: 'Email address',
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})
```

---

## The Step Hierarchy

Blocks and fields live in a step's `blocks` array. Order determines page order:

```
Step
├── Block (heading)
├── Block (intro text)
├── Field (text input)
├── Field (radio buttons)
├── Block (help text)
└── Block (submit button)
```

```typescript
step({
  path: '/contact',
  title: 'Contact Details',
  blocks: [
    HtmlBlock({
      content: '<h1 class="govuk-heading-l">Contact Details</h1>',
    }),

    GovUKTextInput({
      code: 'email',
      label: 'Email address',
    }),

    GovUKButton({
      text: 'Continue',
    }),
  ],
})
```

---

## Block Properties

### `hidden` (Optional)

When true, no HTML is rendered, as rendering for this block is skipped:

```typescript
hidden: Answer('country').not.match(Condition.Equals('UK'))
```

### `metadata` (Optional)

Custom data for application-specific logic:

```typescript
metadata: { section: 'intro', analyticsId: 'welcome-text' }
```

---

## Field Properties

### `code` (Required)

Unique identifier for the answer. Used for storage and `Answer()` references:

```typescript
code: 'email_address'
code: 'business_contact_phone'
```

### `defaultValue` (Optional)

Initial value when no answer exists. When applied, triggers an answer mutation event with source `default`:

```typescript
// Static
defaultValue: 'United Kingdom'

// From another field
defaultValue: Answer('contactEmail')

// From loaded data
defaultValue: Data('user.email')
```

### `validate` (Optional)

Array of validation rules:

```typescript
validate: [
  validation({
    when: Self().not.match(Condition.IsRequired()),
    message: 'Enter your email address',
  }),
  validation({
    when: Self().not.match(Condition.Email.IsValidEmail()),
    message: 'Enter a valid email address',
  }),
]
```

### `formatters` (Optional)

Transformers applied after submission, before validation:

```typescript
formatters: [
  Transformer.String.Trim(),
  Transformer.String.ToLowerCase(),
]
```

### `hidden` (Optional)

When true, no HTML is rendered, as rendering for this block is skipped:

```typescript
hidden: Answer('contactMethod').not.match(Condition.Equals('other'))
```

> **Note:** Hidden fields still participate in validation. Use `dependent` to exclude from validation.

### `dependent` (Optional)

Marks field as depending on another field's value. When condition is false, field is excluded from validation and value is cleared:

```typescript
dependent: Answer('contactMethod').match(Condition.Equals('other'))
```

### `multiple` (Optional)

For checkboxes or components that can somehow return an array of inputs - capture all selected values as an array:

```typescript
multiple: true
```

---

## Dynamic Content

Block and field properties can use expressions:

```typescript
// Using Answer()
HtmlBlock({
  content: Format('<p>Hello, %1!</p>', Answer('firstName')),
})

// Using Data()
HtmlBlock({
  content: Format('<p>Reference: %1</p>', Data('referenceNumber')),
})

// Conditional content
HtmlBlock({
  content: when(Answer('tier').match(Condition.Equals('premium')))
    .then('<p class="govuk-tag">Premium</p>')
    .else('<p class="govuk-tag govuk-tag--grey">Standard</p>'),
})
```

See [References and Chaining](./references-and-chaining.md) for `Answer()`, `Data()`, `Self()`, and other references. See [Logic and Expressions](./logic-and-expressions.md) for `Format()`, `when()`, and predicate combinators.

---

## Conditional Reveal

Radio and checkbox items can reveal additional fields when selected:

```typescript
GovUKRadioInput({
  code: 'hasPhone',
  fieldset: {
    legend: { text: 'Can we contact you by phone?' },
  },
  items: [
    {
      value: 'yes',
      text: 'Yes',
      block: GovUKTextInput({
        code: 'phoneNumber',
        label: 'Phone number',
        inputType: 'tel',
      }),
    },
    { value: 'no', text: 'No' },
  ],
})
```

---

## Best Practices

### Use Semantic Field Codes

```typescript
// DO: Descriptive, snake_case
code: 'email_address'
code: 'date_of_birth'
code: 'business_contact_phone'

// DON'T: Vague or inconsistent
code: 'field1'
code: 'emailAddress'
code: 'DOB'
```

### Pair `hidden` with `dependent`

When a field is conditionally shown (without being a conditional nested in a component that supports it) and has validation:

```typescript
GovUKTextInput({
  code: 'otherMethod',
  label: 'Describe your preferred method',
  // Hide when not "other"
  hidden: Answer('contactMethod').not.match(Condition.Equals('other')),
  // Exclude from validation when not "other"
  dependent: Answer('contactMethod').match(Condition.Equals('other')),
  validate: [
    validation({
      when: Self().not.match(Condition.IsRequired()),
      message: 'Enter your preferred method',
    }),
  ],
})
```

### Order Validation Rules

Required → Format → Business rules:

```typescript
validate: [
  // 1. Required check
  validation({
    when: Self().not.match(Condition.IsRequired()),
    message: 'Enter your age',
  }),
  // 2. Format check
  validation({
    when: Self().not.match(Condition.Number.IsInteger()),
    message: 'Age must be a whole number',
  }),
  // 3. Business rule
  validation({
    when: Self().not.match(Condition.Number.Between(18, 120)),
    message: 'You must be between 18 and 120 years old',
  }),
]
```

See [Validation System](./validation-system.md) for full details on validation rules, error messages, and cross-field validation.
