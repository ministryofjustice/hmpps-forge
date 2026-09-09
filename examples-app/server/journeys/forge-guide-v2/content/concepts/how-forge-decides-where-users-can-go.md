---
title: How Forge decides where users can go
slug: how-forge-decides-where-users-can-go
section: concepts
path: concepts/how-forge-decides-where-users-can-go
nav: Validation and journey progress
order: 15
description:
  How reachability uses entry points, redirects, validation, and request state to decide
  which steps are available
teaches:
  [
    reachability,
    entry-points,
    forward-navigation,
    validation-frontier,
    unreachable-redirects,
  ]
prerequisites: [how-journeys-and-steps-become-routes, how-validation-works]
related:
  concept:
    [
      resuming-a-journey-in-progress,
      clearing-answers-that-no-longer-apply,
      how-validation-works,
    ]
  reference: [journey, step, tie-breaker]
---

# How Forge decides where users can go

Forge uses reachability to decide whether a user can visit a step right now.

That decision comes up whenever a user opens a URL, follows a redirect, resumes a journey,
goes back to edit an answer, or changes a branch. Forge doesn't trust a stored "current
page" value. It derives the current path from the journey definition and the request
state.

Deriving the path each time is what keeps Forge journeys stateless. The application
gives Forge the relevant answers on every request, so Forge works the path out again
rather than storing it.

## The path starts at entry points

An entry point is a step that can start the path.

```ts
step({
  path: "start",
  title: "Start",
  reachability: {
    entryWhen: true,
  },
});
```

Entry points can be conditional. A journey can have one entry point for new users and
another for users returning with an existing case. The condition can read request state in
the same way other expressions do.

If a journey has more than one possible entry point, Forge chooses the active one from the
current request state. That active entry point is also the default place Forge sends users
when they request a step that isn't reachable.

## Forward movement comes from redirects

Forge doesn't treat step order as the navigation model. A step becomes reachable ahead of
the entry point because a valid earlier step can redirect to it.

```ts
submit({
  validate: true,
  onValid: {
    next: [redirect({ goto: "contact-details" })],
  },
});
```

That redirect does two jobs. At submission time it can move the user, while during
reachability it tells Forge which step can come next when the earlier step is valid.

This keeps the authored flow explicit. When a step can lead to three places, all three
appear in its submit behaviour. Nothing is implied by where files sit in a folder.

:::deep-dive
---
title: The reachability walk in pseudocode
description: A simplified version of the request-time walk Forge uses for direct access, back links, stale-answer clearing, and resume.
summary: Show the algorithm
---

This is not the exact engine implementation. It is the useful shape of the algorithm from
an author's point of view.

First, Forge works out which steps are reachable.

```text
for each step:
  step.reachable = false
  step.predecessors = []

for each step:
  if step is an entry point:
    mark step as reachable

  if entryWhen matches the request:
    mark step as reachable

queue = reachable entry points

while queue has steps:
  current = next unvisited step

  current.valid = validate for reachability
  forwardSteps = resolve submit outcomes

  for each next in forwardSteps:
    record current as predecessor

    if current.valid:
      mark next as reachable
      add next to queue
```

The important part is the invalid-step rule. An invalid step can still be reachable,
because the user needs to visit it to fix it. But Forge doesn't use that invalid step to
unlock later steps.

After the walk, Forge chooses one path to treat as the current path for this request.

```text
if resume is active and a progress path exists:
  canonicalPath = deepest progress path

else if the requested step is reachable:
  canonicalPath = path through requested step

else:
  canonicalPath = path from active entry point
```

When two possible paths are both reasonable, authored tie breakers win. If there is still
no winner, Forge falls back to journey declaration order.

Forge derives the frontier from the canonical path.

```text
for each non-entry step in canonicalPath:
  if step is invalid:
    return step as the frontier

if the final progress step is not complete:
  return that final step as the frontier

return no frontier
```

That same reachable graph also gives Forge the information it needs for back links and
stale-answer clearing. Those behaviours all read the same request-time path.

:::

## Validation controls progress

Reachability uses validation to decide how far the path extends. A step can be
reachable and invalid at the same time, because the user needs to reach it to fix it.
But that invalid step doesn't unlock later steps. If the current path reaches
`contact-details` and that step is incomplete, Forge keeps `contact-details` reachable
while preventing the user from skipping ahead to `check-answers`.

For this progress check, Forge uses ordinary validation from the default group.
Submission-only rules don't block reachability.

Validation therefore does two jobs. It renders error messages, and it tells Forge whether
later steps belong to the path yet. A rule that describes a real journey requirement feeds
both.

## Forge needs the journey's answers

Reachability depends on the answers that describe the journey state.

Forge can only derive the path from the state it receives. When a request carries the
answers for every step in the journey, Forge can walk the whole path. When a request
carries only the current step's answers, Forge can display that step, but it cannot
evaluate the branch conditions and validation on earlier steps, so reachability, resume,
and stale-answer clearing all degrade together.

This is the stateless fact at the heart of reachability: Forge recalculates the path from
the definition and request state. It doesn't remember the user's old path internally and
assume it is still correct.

## Some future paths are over approximated

When a future step's redirect depends on data the user hasn't submitted yet, Forge can
see that a branch exists but can't resolve which path will win.

Forge calls this over approximation. It keeps the reachable set wider when the exact
future branch isn't knowable from the current request state. This avoids closing a route
before the user reaches the decision point.

:::deep-dive
---
title: Why Forge over approximates future paths
description: Forge only has the current request state. When a future redirect depends on a future answer, it keeps the possible path wide enough to avoid closing a route too early.
summary: Show details
---

Reachability is a request-time question, not a prediction system.

Forge can follow entry points, validation results, and redirects that are knowable from
the current answers. When a later redirect depends on a value the user hasn't submitted
yet, Forge can see that a future branch exists but can't know which branch will win.

In that situation, Forge keeps the reachable set wider rather than closing a route too
early.

Over approximation is not a replacement for validation or submit redirects. It is a
guardrail for the parts of a future path that are visible but not yet fully resolved.

:::

## Unreachable requests are redirected

If a user requests an unreachable step directly, Forge redirects them to a reachable
place.

By default, that is the active entry point. A journey can instead ask Forge to redirect to
the current frontier, which is the next incomplete point in the current path.

```ts
journey({
  code: "apply",
  path: "/apply",
  title: "Apply",
  reachability: {
    unreachableRedirect: "frontier",
  },
  steps: [startStep, contactDetailsStep, checkAnswersStep],
});
```

If there's no frontier, Forge falls back to the active entry point. The redirect keeps the
URL, answers, and path aligned.

:::note
---
---
This redirect applies to both `GET` and `POST` requests. Because reachability runs before
submit hooks, a submission to an unreachable step is redirected away before the submit
behaviour runs.
:::

## Reachability is not access control

Reachability answers, "does this step belong to this user's current journey path?" Access
control answers, "is this request allowed to use this journey or step at all?"

The two run close together in the request pipeline, but they govern different
concerns. Access hooks own
permissions, authentication, external availability, and loaded state that can block the
journey. Reachability owns path and progress.

That split makes a journey easier to change, because navigation rules stay in the journey
shape while permission rules stay at the boundary where the request is allowed in.
