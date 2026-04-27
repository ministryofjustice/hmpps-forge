---
title: Textarea
section: packages
path: packages/govuk-components/textarea-input
teaches: [GovUKTextareaInput, textarea-input, govuk-textarea-input]
prerequisites: [govuk-components-package, block, validation]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Textarea

A multi-line text input for longer free-text answers. The component
renders the GOV.UK Design System textarea and supports configurable
rows, hints, spellcheck control, and validation.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKTextareaInput` from the GOV.UK components package.
Every textarea needs a `code` and a `label`.

```typescript
import { GovUKTextareaInput } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKTextareaInput({
  code: 'feedback',
  label: 'Give your feedback',
})
```

---

## Label

The label can be a plain string or an object. Use
`isPageHeading: true` when the textarea is the only question on the
page.

```typescript
GovUKTextareaInput({
  code: 'feedback',
  label: {
    text: 'What could we improve?',
    classes: GovUKUtilityClasses.Label.Large,
    isPageHeading: true,
  },
})
```

---

## Hint

Add guidance below the label with the `hint` property.

```typescript
GovUKTextareaInput({
  code: 'description',
  label: 'Describe the incident',
  hint: 'Include the date, time, and location. Do not include personal details of other people.',
})
```

---

## Additional descriptions

Use `describedBy` to add extra element IDs to the textarea's
`aria-describedby` attribute. This is useful when another element on
the page provides guidance that should be announced by screen readers.

```typescript
GovUKTextareaInput({
  code: 'description',
  label: 'Describe the incident',
  describedBy: 'description-guidance',
})
```

---

## Rows

Set the initial height of the textarea with the `rows` property.
The default is 5 rows.

```typescript
GovUKTextareaInput({
  code: 'notes',
  label: 'Brief notes',
  rows: '3',
})

GovUKTextareaInput({
  code: 'fullAccount',
  label: 'Full account of events',
  rows: '10',
})
```

---

## Spellcheck

Disable spellcheck for fields where the browser's suggestions are
unhelpful, such as reference numbers or code.

```typescript
GovUKTextareaInput({
  code: 'jsonPayload',
  label: 'JSON payload',
  spellcheck: false,
})
```

---

## Formatting

Use `formatters` to clean submitted values before they are stored.

```typescript
import { Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

GovUKTextareaInput({
  code: 'feedback',
  label: 'Give your feedback',
  formatters: [Transformer.String.Trim()],
})
```

---

## Validation

Use `validWhen` to add validation rules. Combine `IsRequired()` with
`HasMaxLength()` to enforce a character limit.

```typescript
GovUKTextareaInput({
  code: 'description',
  label: 'Describe the incident',
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a description',
    }),
    validation({
      condition: Self().match(Condition.String.HasMaxLength(2000)),
      message: 'Description must be 2,000 characters or less',
    }),
  ],
})
```

---

## Practical examples

### Detailed description

{{slot:description-example}}

```typescript
GovUKTextareaInput({
  code: 'incidentDescription',
  label: {
    text: 'Describe the incident',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  hint: 'Include the date, time, and location.',
  rows: '8',
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a description of the incident',
    }),
    validation({
      condition: Self().match(Condition.String.HasMaxLength(2000)),
      message: 'Description must be 2,000 characters or less',
    }),
  ],
})
```

### Short notes field

{{slot:notes-example}}

```typescript
GovUKTextareaInput({
  code: 'additionalNotes',
  label: 'Additional notes',
  hint: 'Enter any extra information, or "None".',
  rows: '3',
  formatters: [Transformer.String.Trim()],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter additional notes or "None"',
    }),
  ],
})
```
