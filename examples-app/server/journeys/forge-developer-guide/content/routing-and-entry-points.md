---
title: Routing and entry points
section: building-journeys
path: building-journeys/routing-and-entry-points
teaches: [reachability, routing, redirects, route-mounting, resumeWhen]
prerequisites: [journey, JourneyDefinition]
---

<p class="govuk-caption-xl">Routing, reachability and navigation</p>

# Routing and entry points

Every step in a journey becomes a routable page. Entry points control
where users land when they first arrive at a journey.

{{slot:toc}}

---

## What are routes and entry points?

When Forge mounts a journey, it registers a GET and POST route for every
step. Each step's `path` is joined with its parent journey's `path` to
produce a full route.

```typescript
const travelDeclaration = journey({
  code: 'travel-declaration',
  title: 'Travel declaration',
  path: '/travel-declaration',
  steps: [travelOverviewStep, addTripStep, checkAnswersStep],
})
```

```
GET  /travel-declaration/travel-overview
POST /travel-declaration/travel-overview
GET  /travel-declaration/add-trip
POST /travel-declaration/add-trip
GET  /travel-declaration/check-answers
POST /travel-declaration/check-answers
```

No step is mounted at the journey root (`/travel-declaration` itself).
When a user navigates there, Forge needs to know where to send them.
This is what entry points control.

For nested journeys, paths compose through the full hierarchy. A step at
`/details` inside a child journey at `/child` inside a parent at
`/parent` produces the route `/parent/child/details`.

Forge validates that no two steps produce the same route. If they do,
mounting fails with a `DuplicateRouteError`.

---

## How it works

### Journey root resolution

When a user navigates to a journey's root URL, Forge evaluates entry
points and redirects:

1. If `resumeWhen` is set on the journey and the condition is active,
   Forge redirects to the user's furthest incomplete step (the resume
   frontier).
2. Otherwise, Forge collects all steps marked as entry points
   (unconditional and conditional whose condition is true) and redirects
   to the winner after tie-breaker selection.
3. If no entry points exist, Forge redirects to the first step.
4. If the journey has no steps, the request returns a 404.

If a step claims `path: '/'`, it handles the journey root directly and
this resolution does not apply.

Entry points also play a role in
[reachability](reachability). Forge uses them to determine which steps
a user can access, and redirects users who try to skip ahead.

### Redirect targets in hooks

Hooks can redirect users to other steps or external URLs. Forge
supports three types of redirect target:

**Absolute paths** start with `/`. Resolved from the application root.

```typescript
submit({
  redirectTo: '/travel-declaration/check-answers',
})
```

**Relative paths** do not start with `/`. To redirect to another step in
the same journey, use the step's path without a leading `/`.

```typescript
submit({
  redirectTo: 'check-answers',
})
```

If the current step is at `/travel-declaration/add-trip`, this resolves
to `/travel-declaration/check-answers`.

Relative paths follow browser URL resolution, so `../` traversal also
works for reaching steps in parent or sibling journeys:

```typescript
// Current step: /parent/child/details
submit({
  redirectTo: '../../other-child/summary',
})
// Resolves to: /parent/other-child/summary
```

**External URLs** start with `http://` or `https://`. Used as-is.

```typescript
submit({
  redirectTo: 'https://example.com/confirmation',
})
```

---

## API surface

### `reachability` on journeys (Optional)

Journey-level reachability configuration. Has two properties:

**`resumeWhen`** controls whether Forge's resume behaviour is active
for this journey. When `true`, every request to the journey - whether
to the root or to a specific step - redirects the user to their
furthest incomplete step. When omitted, users can access any reachable
step freely.

```typescript
journey({
  code: 'travel-declaration',
  path: '/travel-declaration',
  title: 'Travel declaration',
  reachability: {
    resumeWhen: Query('resume').match(Condition.Equals('true')),
  },
  steps: [travelOverviewStep, addTripStep, checkAnswersStep],
})
```

`resumeWhen` accepts `true` (always resume) or a condition expression
(resume only when the condition evaluates to true). A common pattern
is to use a query parameter so that task list links can include
`?resume=true` while change links do not.

**`disableReachabilityChecks`** skips the reachability BFS walk for
this journey. All steps are treated as reachable without needing entry
points or forward edges. Child journeys inherit this setting but can
override it with an explicit `false`.

```typescript
journey({
  code: 'developer-guide',
  path: '/developer-guide',
  title: 'Developer Guide',
  reachability: { disableReachabilityChecks: true },
  steps: [introStep, conceptsStep, apiStep],
})
```

See [Reachability](reachability) for details on when and how to use
this option.

### `reachability` on steps (Optional)

Marks a step as an entry point. When `entryWhen` is `true`, the step is
always reachable and Forge will not redirect users away from it.

```typescript
const travelOverviewStep = step({
  path: '/travel-overview',
  title: 'Have you travelled outside the UK in the last 5 years?',
  reachability: { entryWhen: true },
  ...
})
```

`entryWhen` also accepts a condition expression. The step is treated as
an entry point only when the condition evaluates to true. This is useful
for pages that should only be accessible under certain circumstances,
such as a confirmation page that should only be reachable after the user
has submitted their answers.

```typescript
const confirmationStep = step({
  path: '/confirmation',
  title: 'Answers submitted',
  reachability: {
    entryWhen: Session('submitted').match(Condition.Equals(true)),
  },
  ...
})
```

When a conditional entry is active, it takes priority over other steps
when Forge decides where to redirect the user. This ensures the user
lands on the correct page rather than being bounced back to an earlier
step.

`tieBreakers` resolves ambiguity when Forge has multiple candidates to
choose from - whether that is multiple entry points, multiple paths a
user could have taken to reach a step, or multiple redirect targets.
The step with the highest matching priority wins.

```typescript
reachability: {
  entryWhen: true,
  tieBreakers: [tieBreaker({ priority: 100 })],
}
```

### `redirectTo` (Optional)

The target path or URL to redirect to after a hook completes.
Can be an absolute path (`/travel-declaration/check-answers`), a
relative path (`check-answers`), or an external URL
(`https://example.com/confirmation`).

---

## Best practices

- **Always set an entry point.** Every journey should have at least one
  step with `reachability: { entryWhen: true }`. Without one, users
  arriving at the journey root fall back to the first step.
- **Use tie-breakers when multiple entries can be active.** Forge picks
  the tiebreaker-winning active entry as the default landing point when
  resume does not redirect to a frontier.
- **Use `resumeWhen` for sequential journeys.** If users should not be
  able to skip ahead or go back, set `resumeWhen` on the journey to
  enforce forward-only progress.
- **Prefer conditional `resumeWhen` over always-on.** Using a condition
  like `Query('resume').match(Condition.Equals('true'))` lets change
  links on check-answers pages work normally while task list links
  still trigger resume.
- **Use relative redirects for steps in the same journey.** This avoids
  hardcoding the full path and keeps redirects working if the journey's
  path changes.
- **Do not rely on step ordering for reachability.** See
  [Reachability](reachability) for how Forge determines which steps
  are reachable.
