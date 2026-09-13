---
title: Showing fields only when an answer applies
slug: showing-fields-only-when-an-answer-applies
section: how-to-guides
path: how-to-guides/showing-fields-only-when-an-answer-applies
nav: Building journeys/Validation and conditional fields
order: 2
description: Show a follow-up field, validate it only when needed, and clear its answer when the choice changes
teaches: [visibleWhen, dependentWhen, conditional-fields, validation, answer-clearing]
prerequisites: [validating-answers-on-a-step, preparing-field-values-for-storage-and-display]
related:
  concept: [how-validation-works, clearing-answers-that-no-longer-apply]
  how-to: [clearing-answers-when-a-branch-changes]
  reference: [field, answer, validation]
---

# Showing fields only when an answer applies

Some questions only make sense after another answer. Someone who declines email updates doesn't need to give us an email address.

We'll adapt the details page in a job application journey. Everyone enters their name, but only people who want email updates enter an address.
We'll also handle someone returning to change their mind, so the old address stops applying.

## Decide which details each answer needs

An earlier page asks “Do you want email updates about your application?”
It saves `yes` or `no` under the answer code `emailUpdates`.
Both choices lead to the same details page:

| Earlier answer | Fields on the details page |
|---|---|
| Yes | Full name and Email address |
| No | Full name |

The journey's existing access hook loads saved answers before preparing the page.
That makes `Answer('emailUpdates')` available on both visits and submissions, as described in
[Preparing field values for storage and display](./preparing-field-values-for-storage-and-display#load-the-saved-answer-when-somebody-returns).

We have two things to express. The page needs to show the right fields, and validation needs to check only the answers that apply.
Let's start with the fields, then add those conditions.

## Start with the details page

Here's the email field and the details step that contains it:

```typescript
import {
  Answer,
  Condition,
  Self,
  step,
  submit,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKButton,
  GovUKTextInput,
} from '@ministryofjustice/hmpps-forge/govuk-components'

const emailAddressField = GovUKTextInput({
  code: 'emailAddress',
  label: 'Email address',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})

const detailsStep = step({
  code: 'details',
  path: '/details',
  title: 'Your details',
  blocks: [
    GovUKTextInput({
      code: 'fullName',
      label: 'Full name',
      validWhen: [
        validation({
          condition: Self().match(Condition.IsRequired()),
          message: 'Enter your full name',
        }),
      ],
    }),
    emailAddressField,
    GovUKButton({ text: 'Continue' }),
  ],
  onSubmission: [
    submit({ validate: true }),
  ],
})
```

In this example, both answers on the preference step lead to `detailsStep`.
For now, the page shows both inputs. An empty submission reports both required messages.

The `validate: true` hook exposes the validation failures on submission.
Saving and navigation belong in its `onValid` branch, as in
[Saving answers and data from your steps](./saving-answers-and-data-from-your-steps).

## Show the email field when it applies

The email field's <s1>visibility condition</s1> checks the earlier answer:

```typescript [[1, 1, "visibleWhen"]]
visibleWhen: Answer('emailUpdates').match(Condition.Equals('yes')),
```

The `.match()` expression resolves to a boolean.
With `yes` loaded, the details page renders the email input. With `no` loaded, it renders only the name input.

This condition controls rendering on the server. It doesn't attach browser behaviour that reveals a field immediately when someone selects a radio option.
Our choice comes from the earlier page, so it's already available when this page renders.

There is still a problem with a `no` answer: the hidden email field keeps its required rule.
A submission can therefore fail validation for an input the person cannot see.
Hiding the input doesn't say whether its answer still applies.

## Validate only the answers that apply

A matching <s2>dependency condition</s2> expresses when the email answer applies.
The field now looks like this:

```typescript [[1, 4, "visibleWhen"], [2, 5, "dependentWhen"]]
const emailAddressField = GovUKTextInput({
  code: 'emailAddress',
  label: 'Email address',
  visibleWhen: Answer('emailUpdates').match(Condition.Equals('yes')),
  dependentWhen: Answer('emailUpdates').match(Condition.Equals('yes')),
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter your email address',
    }),
  ],
})
```

The conditions use the same answer, but each controls a different part of the request:

| Property | When the condition is false |
|---|---|
| `visibleWhen` | The field doesn't render. |
| `dependentWhen` | Field validation is skipped. Preparing a submission clears its answer. |

With `yes` selected, an empty email input reports “Enter your email address”.
With `no` selected, the field stays hidden and its required rule doesn't run.
The full name remains required in both cases.

We don't need to repeat the email preference inside the validation rule.
`dependentWhen` gates the field's validation, so the rule can concentrate on checking its value.

## Clear the address after a change of mind

Suppose someone chooses email updates and saves `alex@example.com`.
They return to the earlier page, choose “No”, and continue to their details.

The loaded choice now hides the email input.
When they submit the details page, its dependency condition is false.
Answer preparation sets `emailAddress` to `undefined` and records this mutation:

```typescript [[2, 1, "'dependentWhen'"]]
{ value: undefined, source: 'dependentWhen' }
```

The required rule is skipped, and submission hooks read the cleared answer.
This also applies if the submitted body contains an old email address: the dependency check clears the prepared value.

Clearing within a request doesn't remove the address from the application's store.
The save effect must apply the clearing mutation as well as saving answers that still apply.
Use the implementation in [Clearing answers when a branch changes](./clearing-answers-when-a-branch-changes#apply-clearing-mutations-in-your-save-effect).

Opening the details page with “No” selected hides the input, but that visit alone doesn't delete the saved address.
Our example clears the answer when the details page is submitted, then persists that change through the save effect.

## Keep immediate reveals in the component

Our preference and details sit on separate pages.
For a short follow-up on the same page, the [Reveal fields pattern](../patterns/reveal-fields) attaches the input to a radio item's `block`.
The radio component supplies the immediate reveal, while the nested field's `dependentWhen` controls validation and clearing.

Keep that nested field available for the component to reveal.
A server-side `visibleWhen` that omits the input leaves nothing for the browser to show when the selection changes.

## Recap

Our details page now asks for an email address only when someone wants email updates.
Changing that choice also changes which answers count on submission.

Let's recap the key points.

- Use `visibleWhen` to control whether a field renders.
- Pair it with `dependentWhen` when the answer only applies under the same condition.
- Keep each validation rule focused on its value. A false dependency skips the field's validation.
- Expect a false dependency to clear the prepared answer on submission, including a stale value in the submitted body.
- Apply clearing mutations in your save effect so the application's store reflects the change.
- Use a component's reveal behaviour for immediate changes within the page, while retaining `dependentWhen` on the follow-up field.

For answers on entire branches, continue with
[Clearing answers when a branch changes](./clearing-answers-when-a-branch-changes).
