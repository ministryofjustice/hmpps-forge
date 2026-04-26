---
title: Select
section: packages
path: packages/govuk-components/select-input
teaches: [GovUKSelectInput, select-input, govuk-select-input]
prerequisites: [govuk-components-package, block, validation]
---

<p class="govuk-caption-xl">GOV.UK Components</p>

# Select

A dropdown select field that lets the user choose a single option
from a list. The component renders the GOV.UK Design System select
component and supports static items, dynamic items from data, hints,
and validation.

{{slot:basic-example}}

{{slot:toc}}

---

## How to use it

Import `GovUKSelectInput` from the GOV.UK components package. Every
select needs a `code`, a `label`, and an `items` array.

```typescript
import { GovUKSelectInput } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKSelectInput({
  code: 'country',
  label: 'Country',
  items: [
    { value: '', text: 'Choose a country' },
    { value: 'uk', text: 'United Kingdom' },
    { value: 'fr', text: 'France' },
    { value: 'de', text: 'Germany' },
  ],
})
```

Always include a blank placeholder option as the first item so the
select does not default to a real value.

---

## Label

The label can be a plain string or an object. Use
`isPageHeading: true` when the select is the only question on the
page.

```typescript
GovUKSelectInput({
  code: 'relationship',
  label: {
    text: 'What is your relationship to the prisoner?',
    classes: GovUKUtilityClasses.Label.Large,
    isPageHeading: true,
  },
  items: [
    { value: '', text: 'Choose a relationship' },
    { value: 'partner', text: 'Partner or spouse' },
    { value: 'parent', text: 'Parent' },
    { value: 'sibling', text: 'Brother or sister' },
    { value: 'friend', text: 'Friend' },
  ],
})
```

---

## Hint

Add guidance below the label with the `hint` property.

```typescript
GovUKSelectInput({
  code: 'country',
  label: 'Country of residence',
  hint: 'Select the country where you currently live.',
  items: [
    { value: '', text: 'Choose a country' },
    { value: 'uk', text: 'United Kingdom' },
    { value: 'fr', text: 'France' },
  ],
})
```

---

## Disabled options

Disable individual items to prevent selection while keeping them
visible in the list.

```typescript
items: [
  { value: '', text: 'Choose an option', disabled: true },
  { value: 'uk', text: 'United Kingdom' },
  { value: 'fr', text: 'France' },
]
```

---

## Dynamic items from data

Load items from an API or data source using `Data()` with iterators.
The select renders whatever items are in the data at request time.

```typescript
import { Data, Item, Iterator } from '@ministryofjustice/hmpps-forge/core/authoring'

GovUKSelectInput({
  code: 'country',
  label: 'Country',
  items: Data('countries').each(
    Iterator.Map({
      value: Item().path('code'),
      text: Item().path('name'),
    }),
  ),
})
```

---

## Validation

Use `validWhen` to require a selection. The placeholder option with
an empty `value` will fail `IsRequired()`.

```typescript
GovUKSelectInput({
  code: 'country',
  label: 'Country',
  items: [
    { value: '', text: 'Choose a country' },
    { value: 'uk', text: 'United Kingdom' },
    { value: 'fr', text: 'France' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select a country',
    }),
  ],
})
```

---

## Practical examples

### Relationship selector

{{slot:relationship-example}}

```typescript
GovUKSelectInput({
  code: 'relationship',
  label: {
    text: 'Relationship',
    classes: GovUKUtilityClasses.Label.Medium,
  },
  items: [
    { value: '', text: 'Choose a relationship' },
    { value: 'partner', text: 'Partner or spouse' },
    { value: 'parent', text: 'Parent' },
    { value: 'child', text: 'Son or daughter' },
    { value: 'sibling', text: 'Brother or sister' },
    { value: 'friend', text: 'Friend' },
    { value: 'other', text: 'Other' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select your relationship',
    }),
  ],
})
```
