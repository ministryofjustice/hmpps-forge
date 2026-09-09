---
title: Handling missing data and service failures
slug: handling-missing-data-and-service-failures
section: how-to-guides
path: how-to-guides/handling-missing-data-and-service-failures
nav: Loading and saving data
order: 7
description: Handle missing records and service failures while loading or saving data
teaches: [access-hooks, submit-hooks, effects, request-data, throwError, redirect, errors]
prerequisites: [loading-data-for-use-in-your-steps, saving-answers-and-data-from-your-steps, access, submit, effect]
related:
  concept: how-forge-runs-a-request, returning-a-page-redirect-or-error
  reference: access, submit, throw-error, redirect
---

# Handling missing data and service failures

When our services behave themselves, loading and saving are all we need: every case exists, every save succeeds. But real services aren't so obliging! Sometimes the case a user asks for doesn't exist. Sometimes the database falls over mid-request.

To the user staring at their screen, those two feel identical. To our journey, they're quite different. A missing case is a *result* - something we can expect and respond to deliberately: show a "not found" page, redirect somewhere sensible. A failing service is a genuine error, and it belongs with our application's ordinary error handling.

In this how-to, we'll continue the case journey from [Loading data for use in your steps](./loading-data-for-use-in-your-steps) and [Saving answers and data from your steps](./saving-answers-and-data-from-your-steps). We'll handle a missing case first, then see what happens when the case service fails. Let's find out what breaks!

## Start with the loading effect

The case journey already loads its data in an access hook:

```typescript [[1, 15, "LoadCase"], [1, 1, "effect('Cases.LoadCase'"]]
const LoadCase = effect('Cases.LoadCase', {
  factory: (deps: { caseService: CaseService }) =>
    async (context, caseId: string) => {
      const caseRecord = await deps.caseService.get(caseId)

      context.setData('case', caseRecord)
    },
})

const caseJourney = journey({
  path: '/cases/:caseId',
  // ...
  onAccess: [
    access({
      effects: [LoadCase(Params('caseId'))],
    }),
  ],
  steps: [overviewStep, historyStep],
})
```

When the service returns a case, the <s1>loading effect</s1> stores it and the requested
step can render. What should happen if it returns no case at all?

## Record when the data is missing

The journey needs a value it can inspect after the effect runs. Add a boolean alongside
the loaded data:

```typescript [[1, 1, "effect('Cases.LoadCase'"], [2, 6, "context.setData('caseMissing'"]]
const LoadCase = effect('Cases.LoadCase', {
  factory: (deps: { caseService: CaseService }) =>
    async (context, caseId: string) => {
      const caseRecord = await deps.caseService.get(caseId)

      context.setData('caseMissing', caseRecord === undefined)
      context.setData('case', caseRecord)
    },
})
```

The effect still stores the case when one exists. It now also stores the <s2>missing
state</s2> that the access hook needs to decide whether the request can continue.

You might be tempted to throw an error from the effect here. That would stop the request,
but it would hide an expected journey decision inside application code. Keep the effect
focused on loading and describing what it found. The access hook can decide what that
result means for the page.

## Return an error when the data does not exist

Add a `throwError()` outcome after the loading effect:

```typescript [[1, 6, "LoadCase"], [3, 8, "throwError({"], [2, 9, "Data('caseMissing')"], [3, 10, "status: 404"], [3, 11, "message: 'Case not found'"]]
const caseJourney = journey({
  path: '/cases/:caseId',
  // ...
  onAccess: [
    access({
      effects: [LoadCase(Params('caseId'))],
      next: [
        throwError({
          when: Data('caseMissing'),
          status: 404,
          message: 'Case not found',
        }),
      ],
    }),
  ],
  steps: [overviewStep, historyStep],
})
```

The <s1>loading effect</s1> runs first. The <s3>error outcome</s3> can then inspect the
<s2>missing state</s2> it stored. If the case is missing, the request ends with a `404`
before either step is evaluated. If the case exists, the condition is false and the page
continues as before.

This is an error for the request, not a validation error. There is nothing somebody can
correct on the current page to make that case exist.

## Redirect when there is somewhere useful to continue

A missing record does not always need an error response. If somebody can choose another
case, you may prefer to take them back to the case list:

```typescript [[4, 2, "redirect({"], [2, 3, "Data('caseMissing')"], [4, 4, "goto: '/cases'"]]
next: [
  redirect({
    when: Data('caseMissing'),
    goto: '/cases',
  }),
],
```

The <s4>redirect outcome</s4> uses the same <s2>missing state</s2>. Only the response has
changed. Choose the outcome that helps the person recover: return an error when the
requested URL cannot identify a valid resource, or redirect when another page gives them
a sensible next step.

## Use normal error handling for loading failures

Now consider a different problem. The case may exist, but the service call rejects
because the API is unavailable:

```typescript [[5, 2, "caseService.get"]]
deps => async (context: EffectFunctionContext, caseId: string) => {
  const caseRecord = await deps.caseService.get(caseId)

  // ...
}
```

If `caseService.get()` rejects, this is a <s5>service failure</s5>, not missing data. The
effect never receives a result, so it cannot set `caseMissing` and the access hook does
not evaluate its outcomes. The error is caught at the request boundary, turned into an error outcome, and
hands it to the framework adapter. The adapter can then pass it to the framework running
your application's route handling.

## Use the same error handling for saving failures

A saving effect can fail in the same way. The priority step saves first, then redirects
back to the overview:

```typescript [[6, 3, "SaveCasePriority"], [7, 5, "redirect({ goto: 'overview' })"]]
onValid: {
  effects: [
    SaveCasePriority(Params('caseId')),
  ],
  next: [redirect({ goto: 'overview' })],
},
```

If the case service rejects inside the <s6>saving effect</s6>, the error is caught
and its error outcome is handed to the framework adapter. The effect does not complete, so
the <s7>success redirect</s7> is not evaluated.

Catch a service failure inside an effect only when you want to convert it into a journey
decision. Store a marker in the request context, then handle it with an outcome in the
same way as missing data.

## Recap

Your journey now responds differently to data that is absent and data that could not be
loaded or saved.

Let's recap the key points.

- Treat missing data as an expected result that the journey can use.
- Store the missing state into the request context, then choose an outcome in the access
  hook.
- Use `throwError()` when the requested page cannot continue, or `redirect()` when there
  is a useful place for the person to go next.
- Unexpected loading and saving failures become error outcomes for the framework adapter
  to handle.
