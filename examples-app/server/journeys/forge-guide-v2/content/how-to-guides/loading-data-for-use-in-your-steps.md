---
title: Loading data for use in your steps
slug: loading-data-for-use-in-your-steps
section: how-to-guides
path: how-to-guides/loading-data-for-use-in-your-steps
nav: Loading and saving data
order: 5
description: Load data from an external service and make it available to your steps
teaches: [access-hooks, effects, request-data, Data, route-parameters]
prerequisites: [journey, step, block]
related:
  concept: how-forge-runs-a-request
  reference: access
---

# Loading data for use in your steps

Lovely, simple, hardcoded pages are great. But plenty of pages need us to load in some data. Maybe a case loaded from a database, an account fetched from an API, or a list of the user's favourite songs! Whatever it may be, loading data in Forge follows a simple pattern.

In this how-to, we'll explore this pattern by building a case overview page at `/cases/:caseId/overview`. We'll start with the page's shape, work out what data it needs, then swap its placeholder values for the real case our application loads. Let's start!

## Start with the page shape

Start by building the page you want to show. It is fine to use hardcoded values while you
work out the heading, summary, and labels:

```typescript
const overviewStep = step({
  path: '/overview',
  title: 'Case overview',
  blocks: [
    GovUKHeading({
      text: 'Case C12345',
      size: 'l',
    }),
    GovUKSummaryList({
      rows: [
        { key: { text: 'Person' }, value: { text: 'Alex Smith' } },
        { key: { text: 'Status' }, value: { text: 'Open' } },
      ],
    }),
  ],
})

const caseJourney = journey({
  path: '/cases/:caseId',
  // ...
  steps: [overviewStep],
})
```

This gives you a useful page before you involve a service or a database. Once the shape
looks right, you know exactly which values the loader needs to provide.

## Decide what the data needs

Before you write the loader, answer two questions. Is the data needed by this step alone,
or by several steps in the journey? Does it change for each request, based on a route
parameter, the current user, or another request value?

In this example, the case only appears on the overview step, so its loader belongs on
that step. The `:caseId` part of `/cases/:caseId/overview` identifies which case to
load. If the same case later appears on several steps, move the hook to their parent
journey instead.

You now know that the loader needs one argument: the case ID.

## Create a loading effect

Define a clearly named effect. It receives the case ID,
calls your application's case service, and stores the returned record:

```typescript [[1, 1, "effect('Cases.LoadCase'"], [2, 6, "context.setData('case', caseRecord)"]]
const LoadCase = effect('Cases.LoadCase', {
  factory: (deps: { caseService: CaseService }) =>
    async (context, caseId: string) => {
      const caseRecord = await deps.caseService.get(caseId)

      context.setData('case', caseRecord)
    },
})
```

The <s1>load effect</s1> is ordinary application code. It uses its injected dependencies
to call the service. `context.setData()` makes the returned record <s2>data</s2> for the
current request. When you use the effect in a journey definition, it registers itself
automatically.

The effect can load a case now. The next question is when it should run.

## Add the effect to the step

Add an access hook to the step that needs the data. Pass the request value the effect
needs to load the right record:

```typescript [[3, 4, "onAccess: ["], [3, 5, "access({"], [1, 6, "LoadCase"], [4, 6, "Params('caseId')"], [4, 12, ":caseId"]]
const overviewStep = step({
  path: '/overview',
  // ...
  onAccess: [
    access({
      effects: [LoadCase(Params('caseId'))],
    }),
  ],
})

const caseJourney = journey({
  path: '/cases/:caseId',
  // ...
  steps: [overviewStep],
})
```

The <s3>step-level access hook</s3> runs before this step is evaluated. It calls the
<s1>load effect</s1>, and the <s4>route parameter</s4> gives the effect the case ID from
the URL. By the time the blocks are evaluated, the <s2>data</s2> is available.

## Use loaded data in the page

Now replace the hardcoded content with `Data()` references to the data your effect
stored. For this example, those references read the case:

```typescript [[2, 3, "Data('case.reference')"], [2, 8, "Data('case.personName')"], [2, 9, "Data('case.status')"]]
blocks: [
  GovUKHeading({
    text: Data('case.reference'),
    size: 'l',
  }),
  GovUKSummaryList({
    rows: [
      { key: { text: 'Person' }, value: { text: Data('case.personName') } },
      { key: { text: 'Status' }, value: { text: Data('case.status') } },
    ],
  }),
],
```

Each `Data()` reference reads the <s2>data</s2> the effect stored. A request for
`/cases/C12345/overview` now loads case `C12345` and uses its real values to build the
page.

If the requested case might not exist, see
[Handling missing data and service failures](./handling-missing-data-and-service-failures)
to decide whether the request should return an error or redirect somewhere useful.

## Load the same data for several steps

So far, only the overview step needs the case. But suppose you add a history step that
uses the same data:

```typescript [[2, 5, "Data('case.reference')"]]
const historyStep = step({
  path: '/history',
  title: 'Case history',
  blocks: [
    GovUKHeading({ text: Data('case.reference'), size: 'l' }),
    // ...
  ],
})
```

You could add the same access hook to both steps, but the case belongs to the section
they share. Move the hook to their parent journey instead:

```typescript [[3, 4, "onAccess: ["], [3, 5, "access({"], [1, 6, "LoadCase"], [4, 6, "Params('caseId')"], [4, 2, ":caseId"]]
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

The <s3>journey-level access hook</s3> runs before either descendant step is evaluated,
so both pages can read the <s2>data</s2>. It runs for each matching request: opening the
overview and history pages loads the case for each page in turn.

## Recap

You now have pages that load the data they need before they render.

Let's recap the key points.

- Build the page shape with placeholder values before introducing the data source.
- Put the access hook at the narrowest level that needs the data: on one step, or on a
  parent journey when several steps share it.
- Give loading effects clear names, and use their injected dependencies to call your
  application's services.
- Store loaded values with `context.setData()`, then read them from the definition with
  `Data()`.
- Pass request-specific values, such as route parameters, into an effect when they
  determine what it should load.
