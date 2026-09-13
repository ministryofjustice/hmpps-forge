---
title: Preparing field values for storage and display
slug: preparing-field-values-for-storage-and-display
section: how-to-guides
path: how-to-guides/preparing-field-values-for-storage-and-display
nav: Loading and saving data
order: 9
description: Collect a date, save its prepared answer, and show the saved value when somebody returns to edit it
teaches: [formatters, parsers, answer-preparation, saved-answers, validation, submitted-values]
prerequisites: [how-answers-work, saving-answers-and-data-from-your-steps]
related:
  concept: [how-answers-work, how-validation-works]
  how-to: [loading-data-for-use-in-your-steps, creating-your-own-custom-transformer, testing-a-journey]
  reference: [field, answer, access, submit]
---

# Preparing field values for storage and display

A date is easy to recognise on a form. Somebody enters a day, a month, and a year.
But our case service expects one date string, and the form needs those three parts again
when somebody returns to edit it.

We'll add a review date to our case journey. We'll follow the answer from the form into
storage, then back onto the page. Along the way, we'll check what happens when somebody
enters a date that doesn't exist.

## Start with the two shapes you need

Our page asks “When is the case review?” and offers three inputs:

| Day | Month | Year |
|---|---|---|
| 25 | 9 | 2026 |

The case service stores that date as `"2026-09-25"`. We want one consistent answer for
validation and saving, while keeping the separate inputs people expect to use.

`GovUKDateInputFull` already provides this conversion. Its formatter turns submitted date
parts into an ISO date string. Its parser turns the stored string back into parts on a
later `GET`.

Let's start with the field. Add this step to the case journey:

```typescript [[1, 10, "code: 'caseReviewDate'"]]
import { step, submit } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKButton, GovUKDateInputFull } from '@ministryofjustice/hmpps-forge/govuk-components'

const reviewDateStep = step({
  path: '/review-date',
  title: 'When is the case review?',
  reachability: { entryWhen: true },
  blocks: [
    GovUKDateInputFull({
      code: 'caseReviewDate',
      fieldset: {
        legend: {
          text: 'When is the case review?',
          isPageHeading: true,
        },
      },
      hint: 'For example, 25 9 2026',
    }),
    GovUKButton({ text: 'Save and continue' }),
  ],
})
```

The <s1>field code</s1> gives all three inputs one answer, `caseReviewDate`. Open
`/cases/C12345/review-date` and check that the page shows the day, month, and year inputs.
The entry point lets somebody open this editing page before the date is complete.

We don't need to add `formatters` or `parsers` to this field. The component supplies
both when we call it.

## Follow the conversion in each direction

Formatters and parsers are both transformer pipelines. Each takes a value and returns
another value, just like the transformers we use in `.pipe()`. Their place on the field
controls when they run and what Forge does with the result.

For our review date, the two directions look like this:

```text [[3, 2, "date parts"], [7, 3, "formatters"], [2, 4, "prepared answer"], [2, 7, "saved answer"], [8, 8, "parsers"], [3, 9, "display parts"]]
POST
  date parts       { day: '25', month: '9', year: '2026' }
  formatters       parts into an ISO string
  prepared answer  '2026-09-25'

GET
  saved answer     '2026-09-25'
  parsers          ISO string into parts
  display parts    { day: '25', month: '09', year: '2026' }
```

The <s7>formatters</s7> prepare the <s2>answer</s2> that validation and saving will read.
The <s8>parsers</s8> prepare the <s3>display parts</s3> that the date component will render.
They don't write a replacement answer.

These are separate paths. A `POST` runs formatters on the submitted value. A `GET` runs
parsers on the loaded answer, or a default when no answer was loaded. Forge doesn't
run both pipelines every time it displays the page.

## Connect the two value shapes

The conversion uses two transformers. <s7>`ToISO()`</s7> reads the named date parts and
joins them into a string. <s8>`FromISO()`</s8> splits that string into parts again.
Neither calls our case service. Loading and saving remain the effects' jobs.

:::deep-dive
---
title: How the date component prepares its field definition
description: The prepare function adds formatters and parsers when the component is called.
summary: Show how prepare adds the conversion pipelines
---

`GovUKDateInputFull` adds these transformers through Forge's
[`prepare` option](../reference/component). Preparation runs when we call the component
builder, before any request. It takes the authored props and returns the props to put
on the field definition.

Here is the relevant part of the date component's definition:

```typescript [[9, 1, "prepare:"], [7, 3, "formatters:"], [7, 4, "Transformer.Object.ToISO"], [8, 7, "parsers:"], [8, 8, "Transformer.Object.FromISO"]]
prepare: props => ({
  ...props,
  formatters: [
    Transformer.Object.ToISO({ year: 'year', month: 'month', day: 'day' }),
    ...(props.formatters ?? []),
  ],
  parsers: [
    Transformer.Object.FromISO({ year: 'year', month: 'month', day: 'day' }),
    ...(props.parsers ?? []),
  ],
}),
```

The <s9>preparation function</s9> adds the <s7>formatter</s7> and <s8>parser</s8>,
keeping any additional transformers we supplied after them. It builds the pipelines;
it doesn't convert a date at authoring time.

Without that preparation, we would need to supply the equivalent settings ourselves
on a date field that doesn't already add them:

```typescript [[1, 2, "code: 'caseReviewDate'"], [7, 3, "formatters:"], [7, 4, "Transformer.Object.ToISO"], [8, 6, "parsers:"], [8, 7, "Transformer.Object.FromISO"]]
{
  code: 'caseReviewDate',
  formatters: [
    Transformer.Object.ToISO({ year: 'year', month: 'month', day: 'day' }),
  ],
  parsers: [
    Transformer.Object.FromISO({ year: 'year', month: 'month', day: 'day' }),
  ],
}
```

Here, the <s1>field</s1> declares its <s7>formatters</s7> and <s8>parsers</s8> explicitly.
Our `GovUKDateInputFull` call already gets these settings from `prepare`, so keep it as it is.
:::

Each array runs in order, passing one transformer's result to the next. For this date
component, its built-in conversion runs before any transformers we add to that array.
An added formatter therefore receives the ISO string after a successful conversion.
An added parser receives the date-parts object.

That order matters when extending a field. Check the shape arriving at your transformer,
then return the shape the next transformer or component needs. A formatter and parser
aren't automatically paired: adding a formatter doesn't create an inverse parser.

[Learn how to create a transformer for your own conversion rules.](./creating-your-own-custom-transformer)

## Check the prepared date

The browser submits strings for the three <s3>date parts</s3>:

```json [[1, 2, "caseReviewDate"], [3, 3, "\"day\": \"25\""], [3, 4, "\"month\": \"9\""], [3, 5, "\"year\": \"2026\""]]
{
  "caseReviewDate": {
    "day": "25",
    "month": "9",
    "year": "2026"
  }
}
```

During `POST` preparation, the component's formatter turns that object into the
<s2>prepared answer</s2>:

```json [[2, 1, "2026-09-25"]]
"2026-09-25"
```

Validation and submit hooks now read this string. Conversion alone doesn't tell us
whether the date exists, though. A value such as `31 2 2026` still needs a validation rule.

Add `validWhen` to our date field:

```typescript [[1, 4, "code: 'caseReviewDate'"], [4, 12, "validWhen:"], [4, 14, "Self().match(Condition.Date.IsValid())"]]
import { Condition, Self, validation } from '@ministryofjustice/hmpps-forge/core/authoring'

GovUKDateInputFull({
  code: 'caseReviewDate',
  fieldset: {
    legend: {
      text: 'When is the case review?',
      isPageHeading: true,
    },
  },
  hint: 'For example, 25 9 2026',
  validWhen: [
    validation({
      condition: Self().match(Condition.Date.IsValid()),
      message: 'Enter a real review date, including a day, month and year',
    }),
  ],
})
```

The <s4>validation rule</s4> checks the prepared answer. It accepts a real date and
rejects an empty, incomplete, or impossible date. Our rule doesn't restrict when the
review happens. It only asks for a complete date that exists.

Next, add a submit hook to `reviewDateStep` so those failures become visible:

```typescript [[4, 3, "validate: true"]]
onSubmission: [
  submit({
    validate: true,
  }),
],
```

Try submitting `31 2 2026`. The page now shows our message and keeps the three values
available to edit. Nothing is saved yet.

## Save the answer after validation

Our case service needs two operations: save the review date and load it again. Add these
methods to the application's case service:

```typescript
interface CaseService {
  getReviewDate(caseId: string): Promise<string | undefined>
  updateReviewDate(caseId: string, reviewDate: string): Promise<void>
}
```

The service returns an ISO date string when a review date exists, or `undefined` when
the case has none. Its implementation owns the API or database calls.

Now define an effect that saves our <s2>prepared answer</s2>:

```typescript [[6, 3, "effect('Cases.SaveCaseReviewDate'"], [2, 6, "context.getAnswer<string>('caseReviewDate')"], [6, 8, "deps.caseService.updateReviewDate"]]
import { effect } from '@ministryofjustice/hmpps-forge/core/authoring'

const SaveCaseReviewDate = effect('Cases.SaveCaseReviewDate', {
  factory: (deps: { caseService: CaseService }) =>
    async (context, caseId: string) => {
      const reviewDate = context.getAnswer<string>('caseReviewDate')

      await deps.caseService.updateReviewDate(caseId, reviewDate)
    },
})
```

The <s6>saving effect</s6> uses `getAnswer()`, so it receives `"2026-09-25"` after a
valid submission. Reading the raw request body here gives us the date parts instead.

Replace the step's submit hook with one that saves on its valid branch:

```typescript [[4, 5, "validate: true"], [4, 6, "onValid:"], [6, 7, "SaveCaseReviewDate(Params('caseId'))"]]
import { Params, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'

onSubmission: [
  submit({
    validate: true,
    onValid: {
      effects: [SaveCaseReviewDate(Params('caseId'))],
      next: [redirect({ goto: 'overview' })],
    },
  }),
],
```

The <s4>valid branch</s4> runs the <s6>saving effect</s6> before returning the user to
the existing overview step. Supply `caseService` through the package's dependencies,
as in [Saving answers and data from your steps](./saving-answers-and-data-from-your-steps).

Enter `25 9 2026` and save. Check that the service receives `"2026-09-25"` and the
browser returns to the overview. An invalid date must leave the saved value untouched.

## Load the saved answer when somebody returns

The save works, but each Forge request starts with empty answers. Let's load the saved
date before Forge prepares the next request:

```typescript [[5, 1, "effect('Cases.LoadCaseReviewDate'"], [5, 4, "deps.caseService.getReviewDate(caseId)"], [1, 6, "context.setAnswer('caseReviewDate', reviewDate)"]]
const LoadCaseReviewDate = effect('Cases.LoadCaseReviewDate', {
  factory: (deps: { caseService: CaseService }) =>
    async (context, caseId: string) => {
      const reviewDate = await deps.caseService.getReviewDate(caseId)

      context.setAnswer('caseReviewDate', reviewDate)
    },
})
```

The <s5>loading effect</s5> writes the stored string into the same <s1>answer</s1> our
field owns. Use `setAnswer()` here, because we're restoring an answer for the field.

Add an access hook to the case journey. Keep its existing hooks and steps:

```typescript [[5, 8, "access({ effects: [LoadCaseReviewDate(Params('caseId'))] })"]]
import { access, journey } from '@ministryofjustice/hmpps-forge/core/authoring'

const caseJourney = journey({
  code: 'manage-case',
  path: '/cases/:caseId',
  title: 'Manage case',
  onAccess: [
    access({ effects: [LoadCaseReviewDate(Params('caseId'))] }),
    // Keep the journey's other access hooks here.
  ],
  steps: [overviewStep, reviewDateStep],
})
```

Putting the <s5>load on the journey</s5> makes the answer available when either step is
requested. This also gives reachability the saved answer when it checks the review date
step from elsewhere in the journey.

Return to `/cases/C12345/review-date`. On this `GET`, the component's parser turns the
stored string into <s3>display values</s3>:

```json [[3, 2, "\"day\": \"25\""], [3, 3, "\"month\": \"09\""], [3, 4, "\"year\": \"2026\""]]
{
  "day": "25",
  "month": "09",
  "year": "2026"
}
```

The inputs show those parts, including the padded month. The underlying answer stays
`"2026-09-25"`. A parser prepares the field's display value without changing what
`Answer('caseReviewDate')` reads.

The access hook also runs on `POST`. It loads the saved answer first, then answer
preparation replaces it with the new submission. The parser only runs on `GET`.

On a `POST` that renders this page again, the date component receives the submitted
parts instead. Running the parser there would mean handing an object to a transformer
that expects a stored string. It would also lose the distinction between what somebody
typed and the prepared answer we checked.

[Read more about how Forge keeps answers and display values separate.](../concepts/how-answers-work#formatters-and-parsers-point-in-opposite-directions)

## Follow an invalid edit through the request

Suppose somebody returns to the saved date and changes it to `31 2 2026`.

The formatter produces `"2026-02-31"`, but the validation rule rejects it. The save
and redirect sit inside `onValid`, so neither runs. Forge renders the page with the
original submitted parts, `31`, `2`, and `2026`, alongside our error message.

That distinction matters: the answer used for validation and the value shown back in
the inputs can differ on the same request. The user keeps the attempted edit, and the
service keeps its last valid date.

The value shown on the page depends on how the request started:

| Request | Result |
|---|---|
| A valid submission of `25 9 2026` | The service stores `"2026-09-25"` and the browser returns to the overview. |
| A later visit to the date page | The inputs show `25`, `09`, and `2026`. |
| An invalid submission of `31 2 2026` | The page shows an error and keeps `31`, `2`, and `2026`. The service receives no update. |
| A submission with an empty month | The page shows an error and keeps the day and year. The month stays empty. |

When a part is missing, the date formatter cannot produce a full ISO date. Forge keeps
the submitted object for validation, and our date rule rejects it. The failed submission
still doesn't need a parser to redisplay what the user entered.

This fallback is part of field preparation. If a formatter or parser throws a `TypeError`,
Forge keeps the value from before that pipeline started. A transformer returning `undefined`
keeps the current value and lets the pipeline continue. Other errors still fail the request.
That's why conversion needs a validation rule alongside it: retaining an unconvertible
value gives us something to reject and show back to the user.

[Learn how to test prepared answers and field values in a journey.](./testing-a-journey)

## Recap

Our review date now travels from three inputs into one saved string, then back into
the form when somebody returns.

Let's recap the key points.

- Check what preparation the component already supplies before adding your own transformers.
- Use formatters to prepare submitted answers before validation and saving.
- Save prepared answers with `getAnswer()` from the valid branch of a submit hook.
- Load saved answers with `setAnswer()` before answer preparation runs.
- Use parsers to shape stored answers for display on `GET`, leaving the answer itself unchanged.
- Keep invalid submissions on the page so people can correct the values they entered.

For a field with application-specific conversion rules, continue with
[Creating your own custom transformer](./creating-your-own-custom-transformer).
