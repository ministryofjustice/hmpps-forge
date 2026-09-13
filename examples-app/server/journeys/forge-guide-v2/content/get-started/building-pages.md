---
title: Building pages
slug: building-pages
section: get-started
path: get-started/building-pages
nav: Thinking with Forge
order: 3
description: How to describe a set of pages that share a context as one Forge definition
teaches: [journey-as-context, independent-steps, access-hooks, data-references, visibility, effects]
prerequisites: [what-is-forge]
related:
  concept: [how-journeys-and-steps-become-routes, how-forge-runs-a-request, how-expressions-work]
  reference: [journey, step, block, field]
---

# Building pages

Not everything is a form someone fills in step by step. Some parts of a service are pages that share a context: a dashboard, a set of admin screens, a help section. The pages are independent, but they belong together because they need the same data, the same access rules, and the same route space.

Let's build a small team section: three pages that let a user view a team's overview, its members, and (if they're a manager) its settings.

## A journey wraps what the pages share

The three team pages share a route prefix (`/teams/:teamId`), a loaded team, and a set of access rules. In Forge, you draw that boundary with a journey:

```ts [[1, 3, "'/teams/:teamId'"], [2, 5, "disableReachabilityChecks: true"]]
const teamJourney = journey({
  code: 'team',
  path: '/teams/:teamId',
  title: 'Team',
  reachability: { disableReachabilityChecks: true },
  steps: [overviewStep, membersStep, settingsStep],
})
```

The <s1>path</s1> puts all three pages under the same route prefix, with a route parameter for the team.

The <s2>reachability flag</s2> tells Forge that the steps aren't sequential. There's no progression from one to the next, no "first step" the user has to visit before the others. Each page is an independent entry point.

This is the same `journey()` you'd use for a flow. The difference is what you leave out. Without submission hooks, validation chains, or ordered transitions, the journey just groups pages that share a context.

## The data arrives before the page runs

The three pages all need the same team loaded. You do that with an access hook on the journey. It runs before any step in the journey handles a request:

```ts [[3, 9, "Params('teamId')"], [4, 9, "TeamEffects.LoadTeam"]]
const teamJourney = journey({
  code: 'team',
  path: '/teams/:teamId',
  title: 'Team',
  reachability: { disableReachabilityChecks: true },
  onAccess: [
    access({
      effects: [
        TeamEffects.LoadTeam(Params('teamId')),
      ],
    }),
  ],
  steps: [overviewStep, membersStep, settingsStep],
})
```

The <s3>parameter reference</s3> reads the team ID from the route. The <s4>effect</s4> is a function your application supplies. It uses that ID to load the team and make it available as data the steps can reference.

The definition says *when* data should be loaded and *which values to pass*. The application owns the function that does the work. A database query, an API call, a cache lookup: whatever the team's storage requires stays inside the effect.

## Each page reads from the same context

Once the access hook has loaded the team, any step in the journey can reference it. The overview step, for example, shows the team's details:

```ts [[3, 6, "Data('team.name')"], [3, 9, "Data('team.purpose')"], [3, 10, "Data('team.lead')"]]
const overviewStep = step({
  code: 'overview',
  path: '/',
  title: 'Team overview',
  blocks: [
    GovUKHeading({ text: Data('team.name'), size: 'l' }),
    GovUKSummaryList({
      rows: [
        { key: { text: 'Purpose' }, value: { text: Data('team.purpose') } },
        { key: { text: 'Lead' }, value: { text: Data('team.lead') } },
      ],
    }),
  ],
})
```

The step reads the loaded team through <s3>data references</s3>: `Data('team.name')`, `Data('team.purpose')`, and `Data('team.lead')`. They don't contain the team's data; they tell Forge where to find it in the request context. Forge evaluates them when the page renders, against whatever the access hook loaded, so the same definition produces different content for different teams.

The members page also reads from the loaded team, but it needs to show a list rather than a few fixed rows. When a value is an array, you can iterate over it with `.each()` and describe what each item should produce:

```ts
const membersStep = step({
  code: 'members',
  path: '/members',
  title: 'Team members',
  blocks: [
    GovUKHeading({ text: 'Team members', size: 'l' }),
    GovUKSummaryList({
      rows: Data('team.members').each(
        Iterator.Map({
          key: { text: Loop.Item().path('name') },
          value: { text: Loop.Item().path('role') },
        }),
      ),
    }),
  ],
})
```

`Data('team.members').each(Iterator.Map(...))` iterates over the loaded members and produces a summary row for each one. `Loop.Item()` refers to the current member in the iteration.

## Some things depend on who's visiting

The settings page should only be available to team managers. That's a condition on the loaded data, and it belongs on the step itself:

```ts [[3, 7, "Data('isManager').not.match(Condition.Equals(true))"], [4, 8, "redirect({ goto: 'overview' })"]]
const settingsStep = step({
  code: 'settings',
  path: '/settings',
  title: 'Team settings',
  onAccess: [
    access({
      when: Data('isManager').not.match(Condition.Equals(true)),
      next: [redirect({ goto: 'overview' })],
    }),
  ],
  blocks: [
    GovUKHeading({ text: 'Team settings', size: 'l' }),
    // ... settings content
  ],
})
```

The step has its own access hook. The journey-level hook already loaded the team and the user's role, so `Data('isManager')` is available by the time this hook runs.

This access hook uses a <s3>condition</s3> and an <s4>outcome</s4>. The <s3>condition</s3> says when the hook should act, and the <s4>outcome</s4> says what should happen when it does.

Here, non-managers match the condition and get redirected to the overview. Managers pass through and the page renders.

An access hook can block a whole page. But what if the page is fine to visit and you just want to hide one element on it? On the overview page, for example, you might want a link to settings that only managers can see. That's a `visibleWhen` on the block:

```ts
GovUKButton({
  text: 'Manage team settings',
  visibleWhen: Data('isManager'),
})
```

The access hook and the hidden button both check the same loaded permission.

## Every fact is visible in the definition

Look at the definition from the outside in. The journey groups three pages under `/teams/:teamId`. An access hook loads the team and the user's role. The overview shows team details. The members page lists the team. The settings page is restricted to managers, and the link to settings only appears for those who can use it.

There are no routes to configure separately, no middleware to wire up, no template conditionals to keep in sync with access checks.

## Pages can still collect input

Nothing in this example collected input, but it could. The settings page could have fields, validation, and submission hooks just like a flow step. Independent pages don't give up any of that. The difference is that Forge won't enforce an order between them.

## What's next

The next page, **Building flows**, covers the other shape: steps where someone progresses with validation, answers, and transitions connecting them.
