---
title: Saving answers and data from your steps
slug: saving-answers-and-data-from-your-steps
section: how-to-guides
path: how-to-guides/saving-answers-and-data-from-your-steps
nav: Loading and saving data
order: 6
description: Save prepared answers and loaded data through your application's services
teaches: [submit-hooks, effects, answers, request-data, validation, redirect]
prerequisites: [loading-data-for-use-in-your-steps, field, submit, effect]
related:
  concept: how-answers-work
  reference: submit, effect, redirect
---

# Saving answers and data from your steps

Fields are wonderfully easy to add: give one a name, and it collects whatever the user enters. But once the request ends, that answer is gone unless we put it somewhere - an API, a database, wherever our application keeps its data. Saving, like loading, follows a simple pattern.

In this how-to, we'll pick up the case journey from [Loading data for use in your steps](./loading-data-for-use-in-your-steps). We'll add a page that changes the case priority, save the answer through the case service, then send the user back to the overview. Let's get going!

## Start with the answer you want to save

Begin with the page somebody will use. The priority step asks one question and gives its
field a code:

```typescript [[1, 6, "code: 'casePriority'"]]
const priorityStep = step({
  path: '/priority',
  title: 'Change case priority',
  blocks: [
    GovUKRadioInput({
      code: 'casePriority',
      fieldset: {
        legend: {
          text: 'What is the case priority?',
          isPageHeading: true,
        },
      },
      items: [
        { value: 'standard', text: 'Standard' },
        { value: 'urgent', text: 'Urgent' },
      ],
      validWhen: [
        validation({
          condition: Self().match(Condition.IsRequired()),
          message: 'Select the case priority',
        }),
      ],
    }),
    GovUKButton({ text: 'Save and continue' }),
  ],
})

const caseJourney = journey({
  path: '/cases/:caseId',
  // ...
  steps: [overviewStep, priorityStep],
})
```

The field code creates the <s1>answer</s1> named `casePriority`. That answer is prepared when the form is posted. Nothing saves it to the case service yet.

So the next step is to add the application work that will keep it.

## Create a saving effect

Define a clearly named effect. Read the answer from the context and pass it to the
service that owns the case:

```typescript [[2, 1, "effect('Cases.SaveCasePriority'"], [1, 4, "context.getAnswer<string>('casePriority')"], [2, 6, "caseService.updatePriority"]]
const SaveCasePriority = effect('Cases.SaveCasePriority', {
  factory: (deps: { caseService: CaseService }) =>
    async (context, caseId: string) => {
      const priority = context.getAnswer<string>('casePriority')

      await deps.caseService.updatePriority(caseId, priority)
    },
})
```

The <s2>saving effect</s2> reads the <s1>answer</s1> with `context.getAnswer()`. It then
uses the injected case service to save that value outside the journey.

The effect can save the priority now. When should it run?

## Save after the answer is valid

Add a submit hook to the step. Ask it to validate the page, then run the saving effect
from its valid branch:

```typescript [[3, 4, "onSubmission: ["], [3, 5, "submit({"], [4, 6, "validate: true"], [4, 7, "onValid: {"], [2, 9, "SaveCasePriority"], [6, 9, "Params('caseId')"], [5, 11, "redirect({ goto: 'overview' })"], [6, 18, ":caseId"]]
const priorityStep = step({
  path: '/priority',
  // ...
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          SaveCasePriority(Params('caseId')),
        ],
        next: [redirect({ goto: 'overview' })],
      },
    }),
  ],
})

const caseJourney = journey({
  path: '/cases/:caseId',
  // ...
  steps: [overviewStep, priorityStep],
})
```

The <s3>submit hook</s3> runs when the priority step is posted. Its <s4>validation and
valid branch</s4> make sure the answer passes the field's rules before the <s2>saving
effect</s2> runs. The `:caseId` <s6>route parameter</s6> tells the effect which case to
update.

Once the save finishes, the <s5>redirect</s5> returns the person to the overview. Saving
and navigation are separate: the effect changes the case, then the outcome decides where
to go next.

What happens when somebody submits the page without choosing a priority? Validation
fails, so the valid branch does not run. The save is skipped and the page renders again
with its validation message.

If the case service might reject while saving, see
[Handling missing data and service failures](./handling-missing-data-and-service-failures)
for what happens to the request and its success redirect.

## Save without requiring valid answers

Sometimes saving should not wait for the page to be valid. A "Save draft" action, for
example, should keep whatever somebody has entered so far.

Add a second button to the page that identifies the action it submits:

```typescript [[9, 3, "name: 'action'"], [9, 4, "value: 'save-draft'"]]
GovUKButton({
  text: 'Save draft',
  name: 'action',
  value: 'save-draft',
  classes: 'govuk-button--secondary',
})
```

The button posts `action=save-draft`. This gives the submit hook a <s9>submitted
action</s9> it can distinguish from "Save and continue".

Next, create an effect that accepts an answer which may still be empty:

```typescript [[2, 1, "effect('Cases.SaveCaseDraft'"], [1, 4, "context.getAnswer<string | undefined>('casePriority')"], [2, 6, "caseService.saveDraft"]]
const SaveCaseDraft = effect('Cases.SaveCaseDraft', {
  factory: (deps: { caseService: CaseService }) =>
    async (context, caseId: string) => {
      const priority = context.getAnswer<string | undefined>('casePriority')

      await deps.caseService.saveDraft(caseId, { priority })
    },
})
```

Now put an action-specific submit hook before the ordinary save:

```typescript [[3, 2, "submit({"], [9, 3, "Post('action')"], [8, 4, "onAlways: {"], [2, 5, "SaveCaseDraft"], [5, 6, "redirect({ goto: '/cases' })"], [3, 9, "submit({"], [4, 10, "validate: true"], [4, 11, "onValid: {"]]
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('save-draft')),
    onAlways: {
      effects: [SaveCaseDraft(Params('caseId'))],
      next: [redirect({ goto: '/cases' })],
    },
  }),
  submit({
    validate: true,
    onValid: {
      effects: [SaveCasePriority(Params('caseId'))],
      next: [redirect({ goto: 'overview' })],
    },
  }),
],
```

When the <s9>submitted action</s9> is `save-draft`, the first <s3>submit hook</s3>
matches. Its <s8>always branch</s8> runs the <s2>saving effect</s2> without asking the page
to validate, then redirects to the case list.

For every other submission, evaluation moves to the next submit hook. The ordinary path still
uses <s4>validation and its valid branch</s4>, so an invalid answer cannot run the final
save.

Use `onAlways` only when the action is meant to happen regardless of validation. Its
effects run before validation, so work that requires valid answers still belongs in
`onValid`.

## Include loaded data when the save needs it

The case ID and answer may be all your service needs. Sometimes an update also needs data
loaded earlier in the request. For example, the case service might require the current
version so it does not overwrite a newer change.

Add that value to the effect's arguments:

```typescript [[2, 1, "effect('Cases.SaveCasePriority'"], [7, 6, "caseVersion: number"], [1, 8, "context.getAnswer<string>('casePriority')"], [7, 10, "caseVersion"]]
const SaveCasePriority = effect('Cases.SaveCasePriority', {
  factory: (deps: { caseService: CaseService }) =>
    async (
      context,
      caseId: string,
      caseVersion: number,
    ) => {
      const priority = context.getAnswer<string>('casePriority')

      await deps.caseService.updatePriority(caseId, priority, caseVersion)
    },
})
```

Now pass the loaded version when the step calls the effect:

```typescript [[2, 2, "SaveCasePriority"], [7, 4, "Data('case.version')"]]
effects: [
  SaveCasePriority(
    Params('caseId'),
    Data('case.version'),
  ),
],
```

The access hook on the case journey has already loaded the case before the form is
prepared. This lets the <s2>saving effect</s2> receive both the submitted <s1>answer</s1>
and the existing <s7>data</s7> needed for the update.

Pass only the values the save needs. This keeps the operation clear in the definition
and avoids coupling a small update to the journey's entire answer or data context.

## Recap

You now have a step that validates and saves its answer before continuing, or saves a
draft without validating.

Let's recap the key points.

- Put application writes in clearly named effects.
- Read prepared field values with `context.getAnswer()`.
- Run saves that require valid input from the submit hook's `onValid` branch.
- Use `onAlways` for actions, such as saving a draft, that should not require valid
  answers.
- Pass route parameters and loaded data into an effect when the save needs them.
- Keep saving and navigation separate: the effect saves, and the outcome redirects.
