---
title: Radios
section: packages
path: packages/govuk-components/radio-input
teaches: [GovUKRadioInput, radio-input, govuk-radio-input, conditional-reveal]
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

Import `GovUKRadioInput` from the GOV.UK components package. Every
radio group needs a `code`, a `fieldset` with a legend, and an
`items` array.

```typescript
import { GovUKRadioInput } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKRadioInput({
  code: 'contactMethod',
  fieldset: {
    legend: { text: 'How would you prefer to be contacted?' },
  },
  items: [
    { value: 'email', text: 'Email' },
    { value: 'phone', text: 'Phone' },
    { value: 'post', text: 'Post' },
  ],
})
```

---

## Fieldset and legend

Radios are always wrapped in a fieldset with a legend. Use the
`fieldset` property to configure it. When the radio group is the
only question on the page, set `isPageHeading: true` to wrap the
legend in an `<h1>`.

```typescript
GovUKRadioInput({
  code: 'visitType',
  fieldset: {
    legend: {
      text: 'How would you like to meet?',
      classes: GovUKUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  items: [
    { value: 'in-person', text: 'In person' },
    { value: 'video', text: 'Video call' },
    { value: 'phone', text: 'Phone call' },
  ],
})
```

Legend size classes:

| Class | Size |
|---|---|
| `GovUKUtilityClasses.Fieldset.ExtraLargeLabel` | 48px |
| `GovUKUtilityClasses.Fieldset.LargeLabel` | 36px |
| `GovUKUtilityClasses.Fieldset.MediumLabel` | 24px |
| `GovUKUtilityClasses.Fieldset.SmallLabel` | Bold, standard size |

---

## Hints

Add a hint below the legend to give extra guidance. Each individual
item can also have its own hint.

```typescript
GovUKRadioInput({
  code: 'contactMethod',
  fieldset: {
    legend: { text: 'How would you prefer to be contacted?' },
  },
  hint: 'Select one option.',
  items: [
    { value: 'email', text: 'Email', hint: 'We will respond within 24 hours' },
    { value: 'phone', text: 'Phone' },
    { value: 'post', text: 'Post', hint: 'Allow 5 to 7 working days' },
  ],
})
```

---

## Inline layout

For short lists of two or three options, display them horizontally
with `GovUKUtilityClasses.Radios.Inline`.

{{slot:inline-example}}

```typescript
GovUKRadioInput({
  code: 'hasPassport',
  fieldset: {
    legend: { text: 'Do you have a passport?' },
  },
  classes: GovUKUtilityClasses.Radios.Inline,
  items: [
    { value: 'yes', text: 'Yes' },
    { value: 'no', text: 'No' },
  ],
})
```

---

## Dividers

Insert a divider between items to separate a less common option.
The GOV.UK convention is to use the word "or".

{{slot:divider-example}}

```typescript
GovUKRadioInput({
  code: 'country',
  fieldset: {
    legend: { text: 'Where do you live?' },
  },
  items: [
    { value: 'england', text: 'England' },
    { value: 'scotland', text: 'Scotland' },
    { value: 'wales', text: 'Wales' },
    { value: 'northern-ireland', text: 'Northern Ireland' },
    { divider: 'or' },
    { value: 'abroad', text: 'I live abroad' },
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

```typescript
GovUKRadioInput({
  code: 'heardFrom',
  fieldset: {
    legend: { text: 'How did you hear about us?' },
  },
  items: [
    { value: 'search-engine', text: 'Search engine' },
    {
      value: 'social-media',
      text: 'Social media',
      block: GovUKTextInput({
        code: 'socialMediaPlatform',
        label: 'Which platform?',
        dependentWhen: Answer('heardFrom').match(Condition.Equals('social-media')),
        classes: GovUKUtilityClasses.Input.Width20,
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter the platform where you saw us',
          }),
        ],
      }),
    },
    { value: 'friend', text: 'Friend or colleague' },
    {
      value: 'other',
      text: 'Other',
      block: GovUKTextInput({
        code: 'otherSource',
        label: 'Please specify',
        dependentWhen: Answer('heardFrom').match(Condition.Equals('other')),
        classes: GovUKUtilityClasses.Input.Width20,
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Enter where you heard about us',
          }),
        ],
      }),
    },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select how you heard about us',
    }),
  ],
})
```

---

## Validation

Use `validWhen` to require a selection. The error message appears
above the fieldset.

```typescript
GovUKRadioInput({
  code: 'contactMethod',
  fieldset: {
    legend: { text: 'How would you prefer to be contacted?' },
  },
  items: [
    { value: 'email', text: 'Email' },
    { value: 'phone', text: 'Phone' },
    { value: 'post', text: 'Post' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select how you would prefer to be contacted',
    }),
  ],
})
```

---

## Conditional visibility

Control when the entire radio group appears using `visibleWhen`.

```typescript
GovUKRadioInput({
  code: 'preferredDay',
  fieldset: {
    legend: { text: 'Which day works best?' },
  },
  visibleWhen: Answer('visitType').match(Condition.Equals('in-person')),
  items: [
    { value: 'monday', text: 'Monday' },
    { value: 'wednesday', text: 'Wednesday' },
    { value: 'friday', text: 'Friday' },
  ],
})
```

---

## Practical examples

### Single question page

{{slot:single-question-example}}

```typescript
GovUKRadioInput({
  code: 'visitType',
  fieldset: {
    legend: {
      text: 'How would you like to meet?',
      classes: GovUKUtilityClasses.Fieldset.LargeLabel,
      isPageHeading: true,
    },
  },
  hint: 'Pick the option that works best for you.',
  items: [
    { value: 'in-person', text: 'In person' },
    { value: 'video', text: 'Video call' },
    { value: 'phone', text: 'Phone call' },
  ],
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Select how you would like to meet',
    }),
  ],
})
```
