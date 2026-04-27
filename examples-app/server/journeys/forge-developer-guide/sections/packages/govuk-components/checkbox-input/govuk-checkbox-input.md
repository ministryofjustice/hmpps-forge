---
title: Checkboxes
section: packages
path: packages/govuk-components/checkbox-input
teaches: [GovUKCheckboxInput, checkbox-input, govuk-checkbox-input, exclusive-checkbox, visibleWhen]
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

Import `GovUKCheckboxInput` from the GOV.UK components package. Every
checkbox group needs a `code`, a `fieldset` with a legend, and an
`items` array.

The field value is always an array of the selected items' values.

```typescript
import { GovUKCheckboxInput } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKCheckboxInput({
  code: 'contactMethods',
  fieldset: {
    legend: { text: 'How would you like to be contacted?' },
  },
  hint: 'Select all that apply.',
  items: [
    { value: 'email', text: 'Email' },
    { value: 'phone', text: 'Phone' },
    { value: 'post', text: 'Post' },
  ],
})
```

---

## Fieldset and legend

Checkboxes are always wrapped in a fieldset with a legend. When the
checkbox group is the only question on the page, set
`isPageHeading: true` to wrap the legend in an `<h1>`.

```typescript
GovUKCheckboxInput({
  code: 'countriesVisited',
  fieldset: {
    legend: {
      text: 'Which countries have you visited?',
      classes: GovUKUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  hint: 'Select all that apply.',
  items: [
    { value: 'uk', text: 'United Kingdom' },
    { value: 'france', text: 'France' },
    { value: 'germany', text: 'Germany' },
  ],
})
```

---

## Hints

Add a hint below the legend with the `hint` property. Each individual
item can also have its own hint.

```typescript
GovUKCheckboxInput({
  code: 'contactMethods',
  fieldset: {
    legend: { text: 'How would you like to be contacted?' },
  },
  hint: 'Select all that apply.',
  items: [
    { value: 'email', text: 'Email', hint: 'We will respond within 24 hours' },
    { value: 'phone', text: 'Phone' },
    { value: 'post', text: 'Post', hint: 'Allow 5 to 7 working days' },
  ],
})
```

---

## Additional descriptions

Use `describedBy` to add extra element IDs to the checkbox group's
`aria-describedby` attribute. With the usual fieldset wrapper, this
describes the fieldset. If you set `fieldset.describedBy`, GOV.UK
Frontend uses that value instead.

```typescript
GovUKCheckboxInput({
  code: 'contactMethods',
  fieldset: {
    legend: { text: 'How would you like to be contacted?' },
  },
  describedBy: 'contact-methods-guidance',
  items: [
    { value: 'email', text: 'Email' },
    { value: 'phone', text: 'Phone' },
  ],
})
```

---

## Exclusive behaviour

Add a "none of the above" option using `behaviour: 'exclusive'`.
When the exclusive checkbox is selected, all other checkboxes are
unchecked. When any other checkbox is selected, the exclusive
checkbox is unchecked.

{{slot:exclusive-example}}

```typescript
GovUKCheckboxInput({
  code: 'contactMethods',
  fieldset: {
    legend: { text: 'How would you like to be contacted?' },
  },
  hint: 'Select all that apply.',
  items: [
    { value: 'email', text: 'Email' },
    { value: 'phone', text: 'Phone' },
    { value: 'post', text: 'Post' },
    { divider: 'or' },
    { value: 'none', text: 'I do not want to be contacted', behaviour: 'exclusive' },
  ],
})
```

---

## Dividers

Insert a divider between items to visually separate a less common
option. The GOV.UK convention is to use the word "or", typically
paired with an exclusive checkbox.

```typescript
items: [
  { value: 'email', text: 'Email' },
  { value: 'phone', text: 'Phone' },
  { divider: 'or' },
  { value: 'none', text: 'None of the above', behaviour: 'exclusive' },
]
```

---

## Conditional items

Use `visibleWhen` on an item or divider to omit it from rendering.
This only controls presentation. It does not clear or reject a
previously stored answer; use `dependentWhen`, validation, or a hook
when the answer itself should no longer apply.

```typescript
GovUKCheckboxInput({
  code: 'contactMethods',
  fieldset: {
    legend: { text: 'How would you like to be contacted?' },
  },
  items: [
    { value: 'email', text: 'Email' },
    {
      value: 'sms',
      text: 'Text message',
      visibleWhen: Data('smsContactEnabled'),
    },
    { divider: 'or', visibleWhen: Data('showNoContactOption') },
    { value: 'none', text: 'I do not want to be contacted', behaviour: 'exclusive' },
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

```typescript
GovUKCheckboxInput({
  code: 'notifications',
  fieldset: {
    legend: { text: 'How should we notify you?' },
  },
  items: [
    {
      value: 'email',
      text: 'Email',
      block: GovUKTextInput({
        code: 'notificationEmail',
        label: 'Email address',
        inputType: 'email',
        dependentWhen: Answer('notifications').match(Condition.Array.Contains('email')),
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter an email address',
          }),
        ],
      }),
    },
    {
      value: 'sms',
      text: 'Text message',
      block: GovUKTextInput({
        code: 'notificationPhone',
        label: 'Phone number',
        inputType: 'tel',
        dependentWhen: Answer('notifications').match(Condition.Array.Contains('sms')),
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter a phone number',
          }),
        ],
      }),
    },
  ],
})
```

Note: because checkboxes produce an array, use
`Condition.Array.Contains()` for `dependentWhen` rather than
`Condition.Equals()`.

---

## Small checkboxes

Use `GovUKUtilityClasses.Checkboxes.Small` for a more compact layout
when the options are secondary or there are many of them.

```typescript
GovUKCheckboxInput({
  code: 'filters',
  fieldset: {
    legend: { text: 'Filter by status' },
  },
  classes: GovUKUtilityClasses.Checkboxes.Small,
  items: [
    { value: 'active', text: 'Active' },
    { value: 'pending', text: 'Pending' },
    { value: 'closed', text: 'Closed' },
  ],
})
```

---

## Validation

Use `validWhen` to require at least one selection. Since the field
value is an array, `Condition.IsRequired()` returns false for an
empty array.

```typescript
GovUKCheckboxInput({
  code: 'terms',
  fieldset: {
    legend: { text: 'Terms and conditions' },
  },
  items: [
    { value: 'agreed', text: 'I agree to the terms and conditions' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'You must agree to the terms and conditions',
    }),
  ],
})
```

---

## Practical examples

### Single question page

{{slot:single-question-example}}

```typescript
GovUKCheckboxInput({
  code: 'countriesVisited',
  fieldset: {
    legend: {
      text: 'Which countries have you visited?',
      classes: GovUKUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  hint: 'Select all that apply.',
  items: [
    { value: 'uk', text: 'United Kingdom' },
    { value: 'france', text: 'France' },
    { value: 'germany', text: 'Germany' },
    { value: 'spain', text: 'Spain' },
    { divider: 'or' },
    { value: 'none', text: 'I have not visited any of these', behaviour: 'exclusive' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select which countries you have visited, or select that you have not visited any',
    }),
  ],
})
```
