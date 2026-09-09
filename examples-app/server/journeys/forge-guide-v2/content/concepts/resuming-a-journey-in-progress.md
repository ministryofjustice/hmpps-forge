---
title: How Forge resumes a journey
slug: resuming-a-journey-in-progress
section: concepts
path: concepts/resuming-a-journey-in-progress
nav: Validation and journey progress
order: 16
description: How Forge chooses the right step when a user returns to an unfinished journey
teaches: [resume, frontier, progress, journey-route, unreachable-redirects]
prerequisites:
  [how-forge-decides-where-users-can-go, how-validation-works]
related:
  concept:
    [
      how-forge-decides-where-users-can-go,
      clearing-answers-that-no-longer-apply,
      how-journeys-and-steps-become-routes,
    ]
  reference: [journey, step, tie-breaker]
---

# Resuming a journey in progress

A journey route answers one question: where does the user go next?

When a user opens the journey root, Forge redirects them to a step. For a user with no
progress, that redirect lands on the active entry point. When the journey supports resume
and the user has progress, the same redirect lands on the next incomplete step instead.

That next incomplete step is the frontier.

## The journey route redirects to a step

A journey is mounted at a route, and its steps are mounted underneath it.

The journey route itself is not a page. Forge resolves the correct step and redirects
there.

For a new user, the redirect lands on the active entry point:

```txt
/apply
/apply/start
```

For a returning user with progress, the journey resumes:

```txt
/apply
/apply/contact-details
```

The journey route is a decision point, not a page the user completes.

## Resume uses current answers

Resume uses the same reachability model as direct step access. Forge evaluates the loaded
answers against the current path, checks which steps are valid, and finds the next
incomplete step. Because resume reads the same request state as every other phase, it is
exactly as reliable as the answers the application loads. Forge can't resume from answers
it doesn't have.

This keeps resume stateless. Instead of storing a "resume step" marker, Forge derives the
right step from the journey definition and the current answers each time.

## Progress starts when a valid step exists

Resume activates only once the user has progress.

Forge treats progress as existing when the reachable path contains at least one step whose
validation passes. A route visit alone doesn't count, so a new user who opened the first
page but submitted nothing still lands on the entry point.

Starting a journey and continuing a journey are the same route decision, using the same
path model.

## The frontier is the next incomplete point

The frontier is the first step on the current path that still needs attention.

If the user completed `start` and `contact-details`, the frontier is
`employment-details`. If they go back and change an answer that makes `contact-details`
invalid again, the frontier moves back to `contact-details`.

That movement is the point. Resume follows the journey as it is now, not the journey as
it looked last week.

The frontier can be absent when the journey is complete or when no step on the current
path is incomplete. In either case, Forge falls back to the active entry point.

## Resume doesn't interrupt submission

Resume applies to requests that enter the journey route or need a reachable fallback.

It never interrupts a `POST`. When a user submits a step, the submit behaviour owns the
next outcome: a redirect, a render with errors, or an error result.

This split matters. Resume helps a user return to work. Submit behaviour handles the work
the user just did.

:::note
---
---
Reachability can still interrupt a `POST`. Because reachability runs before submit hooks,
a submission to an unreachable step is redirected away before the submit behaviour runs.
Resume doesn't cause that redirect — reachability does.
:::

## Old links still need reachability

Users keep links. They bookmark pages, click old emails, and reuse the browser history, so
a saved link can point at a step that no longer belongs to the user's current path.

When that happens, Forge uses reachability to redirect them. A journey declares whether
unreachable requests go to the active entry point or to the current frontier:

```ts
journey({
  code: "apply",
  path: "/apply",
  title: "Apply",
  reachability: {
    unreachableRedirect: "frontier",
  },
  steps: [startStep, detailsStep, checkAnswersStep],
});
```

With `"frontier"`, a stale link redirects to the next incomplete step. If no frontier
exists, Forge falls back to the active entry point.

## Back links can follow the reachable path

Back links are another place where reachability helps.

A step with a fixed predecessor carries an explicit back link. When the predecessor
depends on the user's path through the journey, Forge derives the previous step from the
reachable path instead.

That means branch pages don't need hard-coded back links for every route into them. The
back link follows the path the user is on.

## Resume is a result of the journey model

Resume takes users to the step they expect to complete next. Forge derives that step from
pieces the journey already defines: the loaded answers, each step's validation, the submit
redirects that model forward movement, and the reachability rules that close old branches.

Because each piece already exists for ordinary navigation, resume is a result of the
journey model rather than a second navigation system.
