---
title: Routing and entry points
section: building-journeys
path: building-journeys/routing-and-entry-points
teaches: [entryPath, isEntryPoint, routing, redirects, route-mounting]
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

### Entry point resolution

Forge resolves the entry point in this order:

1. The journey's `entryPath` property, if set.
2. The first step in the `steps` array with `isEntryPoint: true`.
3. If neither is set, no redirect is registered and requests to the
   journey root will return a 404.

If the resolved entry path is `/` (the same as the journey root), Forge
skips the redirect to avoid an infinite loop.

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

### `entryPath` (Optional)

The step path to redirect to when a user navigates to the journey's root
URL. Takes priority over `isEntryPoint`.

```typescript
journey({
  code: 'travel-declaration',
  path: '/travel-declaration',
  title: 'Travel declaration',
  entryPath: '/travel-overview',
  steps: [travelOverviewStep, addTripStep, checkAnswersStep],
})
```

A request to `/travel-declaration` redirects to
`/travel-declaration/travel-overview`.

### `isEntryPoint` (Optional)

Marks a step as a reachable entry point. When set, this step is used as
the redirect target if the journey has no `entryPath`. It is also always
considered reachable, so Forge will not redirect users away from it.

```typescript
const travelOverviewStep = step({
  path: '/travel-overview',
  title: 'Have you travelled outside the UK in the last 5 years?',
  isEntryPoint: true,
  ...
})
```

### `redirectTo` (Optional)

The target path or URL to redirect to after a hook completes.
Can be an absolute path (`/travel-declaration/check-answers`), a
relative path (`check-answers`), or an external URL
(`https://example.com/confirmation`).

---

## Best practices

- **Always set an entry point.** Every journey should have either
  `entryPath` or a step with `isEntryPoint: true`. Without one, users
  arriving at the journey root will get a 404.
- **Prefer `isEntryPoint` over `entryPath`.** It keeps the entry point
  co-located with the step definition rather than duplicating the path
  string on the journey.
- **Use relative redirects for steps in the same journey.** This avoids
  hardcoding the full path and keeps redirects working if the journey's
  path changes.
- **Do not rely on step ordering for reachability.** See
  [Reachability](reachability) for how Forge determines which steps
  are reachable.
