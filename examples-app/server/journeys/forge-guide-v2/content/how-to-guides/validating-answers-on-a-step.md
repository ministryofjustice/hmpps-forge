---
title: Validating answers on a step
slug: validating-answers-on-a-step
section: how-to-guides
path: how-to-guides/validating-answers-on-a-step
nav: Building journeys/Validation and conditional fields
order: 1
description: Require answers, compare two fields, and show messages that explain what needs to change
teaches: [validation, validWhen, field-validation, step-validation, self, answer, submit-validation]
prerequisites: [step, field]
related:
  concept: [how-validation-works]
  how-to: [showing-fields-only-when-an-answer-applies, creating-your-own-custom-condition, testing-a-journey]
  reference: [validation, self, answer, submit]
---

# Validating answers on a step

A missing answer is easy to spot. Two answers that look fine separately can be harder to catch.
When somebody links two cases, both references can look right, even when they point to the same case.

We'll build a page that asks for two case references. Each field needs an answer, and the references must be different.
Along the way, we'll give each failure a message that helps somebody put it right.

## Start with the answers you need

Our page has two text inputs and a Continue button:

| Field | Example answer |
|---|---|
| First case reference | C12345 |
| Second case reference | C67890 |

An empty field needs its own message. If both references are the same, the problem belongs to the pair.
We'll keep that distinction in the definition too.

Let's start with a step that collects the two references:

```typescript
import {
  Answer,
  Condition,
  Self,
  redirect,
  step,
  submit,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKButton, GovUKTextInput } from '@ministryofjustice/hmpps-forge/govuk-components'

const linkCasesStep = step({
  path: '/link-cases',
  title: 'Link cases',
  reachability: { entryWhen: true },
  blocks: [
    GovUKTextInput({
      code: 'firstCaseReference',
      label: 'First case reference',
    }),
    GovUKTextInput({
      code: 'secondCaseReference',
      label: 'Second case reference',
    }),
    GovUKButton({ text: 'Continue' }),
  ],
})
```

`entryWhen: true` makes this page an entry point, so somebody can open it before either answer is complete.
The page now collects two separate answers. Neither field has a rule yet, so an empty reference doesn't make the step invalid.

## Require an answer in each field

A <s1>`validWhen` rule</s1> makes the first input required:

```typescript [[1, 4, "validWhen"], [2, 6, "Self().match(Condition.IsRequired())"]]
GovUKTextInput({
  code: 'firstCaseReference',
  label: 'First case reference',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter the first case reference',
    }),
  ],
})
```

The <s2>condition</s2> describes a valid answer. `Self()` reads the value of the field containing the rule.
`Condition.IsRequired()` returns `false` for missing values, empty strings, and strings containing only whitespace.

The message names the missing answer and tells somebody what to enter. It appears when this rule fails and validation errors are displayed.

The second input follows the same shape, with its own code, label, and message:

```typescript
GovUKTextInput({
  code: 'secondCaseReference',
  label: 'Second case reference',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter the second case reference',
    }),
  ],
})
```

Notice that `Self()` stays the same. Each rule reads its own field without repeating the field code inside the condition.
Both fields now require an answer, but opening the page still doesn't display errors.

## Show errors when somebody continues

The rules describe acceptable answers. Next, we'll use a submit hook to decide what happens when somebody presses Continue.

The step's <s3>`onSubmission`</s3> hook connects validation to the Continue button:

```typescript [[3, 1, "onSubmission"], [3, 3, "validate: true"]]
onSubmission: [
  submit({
    validate: true,
    onValid: {
      next: [redirect({ goto: 'check-answers' })],
    },
  }),
],
```

`validate: true` runs the default validation group for this step. Our rules belong to that group because we didn't name another one.

An empty submission now renders the page with both missing-reference messages. With only one reference entered, only the other field has a required-answer error.
The `onValid` redirect runs when validation passes.

This hook only redirects. To keep the answers for the next request, add your application's save effect to `onValid.effects`, before `next`.
[Saving answers and data from your steps](./saving-answers-and-data-from-your-steps) covers saving and loading those answers.

We don't need an `onInvalid` redirect here. Without one, the request continues to render the current page with its validation failures.

Field failures attach to their fields. Validation errors are provided to the renderer and page template, where an error summary can use them for display.
[How validation works](../concepts/how-validation-works) explains the difference between checking validity and displaying errors.

## Check that the references are different

Both fields now accept `C12345`. Each answer passes its required rule, but together they attempt to link a case to itself.

A <s4>step-level `validWhen`</s4> expresses the rule about both references:

```typescript [[4, 1, "validWhen"], [5, 3, "Answer('firstCaseReference').not.match("], [5, 4, "Condition.Equals(Answer('secondCaseReference'))"]]
validWhen: [
  validation({
    condition: Answer('firstCaseReference').not.match(
      Condition.Equals(Answer('secondCaseReference')),
    ),
    message: 'Enter two different case references',
  }),
],
```

At step level, `Answer()` identifies each field by its code. There isn't a single current field for `Self()` to refer to.
The <s5>comparison</s5> passes when the two answers differ.

All active validation rules run, even when another rule fails. Two empty strings also match, so submitting both fields empty reports all three errors.

This comparison uses exact values. It doesn't change capitalisation, remove spaces, or check whether either case exists.
If your service normalises references, prepare those values before comparing them, as described in [Preparing field values for storage and display](./preparing-field-values-for-storage-and-display).

## Match each message to the problem

Our page now distinguishes missing answers from an invalid pair:

| First reference | Second reference | Result on Continue |
|---|---|---|
| Empty | Empty | Enter the first case reference. Enter the second case reference. Enter two different case references. |
| C12345 | Empty | Enter the second case reference. |
| C12345 | C12345 | Enter two different case references. |
| C12345 | C67890 | Continue to check your answers. |

The first two messages belong to fields. The relationship message belongs to the step, so it becomes a page-level domain error.
Both field and domain errors are available to the renderer and page template, so an error summary can display them together.

We didn't need another submit hook for the relationship rule. The existing `validate: true` includes the step's default-group rules as well as its field rules.

That gives the user a useful next action for each failure. “Invalid references” leaves them guessing, while “Enter two different case references” identifies the problem.

## Recap

The page now requires both references and prevents a case from linking to itself.

Let's recap the key points.

- Put a rule in a field's `validWhen` when the failure belongs to that field.
- Use `Self()` to read the field's value, and `Answer()` to read another named answer.
- Put rules about the relationship between answers in the step's `validWhen`.
- Field and step rules run independently, so a submission can report both kinds of error.
- Use `validate: true` in a submit hook to display failures and run `onValid` only when validation passes.
- Write messages that name the answer or relationship somebody needs to change.

When a field only applies after another choice, continue with [Showing fields only when an answer applies](./showing-fields-only-when-an-answer-applies).
