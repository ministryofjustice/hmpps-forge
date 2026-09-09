---
title: How journeys and steps become routes
slug: how-journeys-and-steps-become-routes
section: concepts
path: concepts/how-journeys-and-steps-become-routes
nav: Routes and application structure
order: 20
description:
  How journeys, nested journeys, steps, and mounted paths form the URLs an application
  exposes
teaches: [journeys, steps, routes, nested-journeys, mounted-paths]
prerequisites: [how-forge-runs-a-request]
related:
  concept: [how-forge-decides-where-users-can-go, how-blocks-resolution-and-rendering-connect]
  reference: [journey, step]
---

# How journeys and steps become routes

Every URL in a Forge application comes from its journey and step definitions. A journey
defines a section of the application, and steps define pages inside it. The final URLs
follow from the nesting.

Routes are not registered separately. The journey definition *is* the route structure.

## Step paths build on the journey path

A journey declares a path, and each step inside it declares a path relative to the
journey's.

```ts
journey({
  code: "apply",
  path: "/apply",
  title: "Apply",
  steps: [
    step({
      path: "/contact-details",
      title: "Contact details",
      blocks: [],
    }),
  ],
});
```

Forge joins the journey path with the step path to produce the final URL. This step
resolves to `/apply/contact-details`.

The journey path is more than a URL prefix. Forge also uses it to resolve redirect paths
to their target steps, build route data for rendering, and evaluate which steps the user
can reach.

## Paths can contain route parameters

Journey and step paths can include `:param` segments. These work the same way as static
path segments: they compose through nesting.

```ts
journey({
  code: "manage-application",
  path: "/applications/:applicationId",
  title: "Manage application",
  steps: [
    step({
      path: "/overview",
      title: "Overview",
      blocks: [],
    }),
  ],
});
```

This step resolves to `/applications/:applicationId/overview`. Forge captures the value
of `:applicationId` from the request URL and makes it available to expressions and hooks
inside the journey.

## The journey code is its stable identity

The `code` property identifies the journey, and Forge uses it in diagnostics, traces,
and package registration.

The code and the path change at different rates. A path can change when a service
restructures its routes, but a code named after the business domain stays meaningful
through those changes.

```ts
journey({
  code: "change-contact-details",
  path: "/contact-details",
  title: "Change contact details",
  steps: [],
});
```

Generic codes like `form` or `start` lose that stability because they don't describe
what the journey does.

## Nested journeys compose paths

A journey can contain child journeys through its `children` property. Each child adds
another segment to the URL, and its steps live inside that segment.

For example, a licence journey can contain an employment child journey. A step inside
that child is part of both the licence flow and the employment section. Its URL reflects
that nesting: `/licence/employment/add-employer`.

Child journeys break a large flow into named sections without losing the parent
journey's context. Each child journey can carry its own access hooks, data, and
reachability behaviour.

## The route tree is static

Forge registers the full route tree when a package loads, and the tree does not change
at request time.

Because the set of journeys and steps is fixed, iterators, generators, and expressions
cannot produce routes. That guarantee is what lets Forge analyse reachability, resolve
redirect paths, and detect duplicate routes before the application handles any requests.

What varies at a given route is the request behaviour, not the structure. Path
parameters, access hooks, redirect outcomes, and reachability rules all change what
happens when a request arrives, while the route itself stays where it was registered.

:::deep-dive
---
title: How redirect paths resolve against the route tree
description: Forge resolves authored redirect paths within the current journey's route catalog. Paths that point outside the journey are silently dropped from the reachability graph.
summary: How redirect paths resolve
---

When a step declares a redirect like `redirect({ goto: '../check-answers' })`, Forge
resolves that path against the route tree at registration time.

Absolute paths (starting with `/`) resolve from the root. Relative paths resolve from
the current step's position in the tree, so `..` moves up one segment.

The important constraint is scope. Each journey, including nested child journeys, has
its own route catalog containing only its own steps. Forge checks each resolved path
against that catalog.

If a redirect path resolves to a step outside the current journey, Forge drops it from
the reachability graph without reporting an error. Reachability analysis, resume
behaviour, and cleardown will not account for that path. Cross-journey navigation works
at runtime, but Forge can only trace redirect paths that stay within the same journey.

:::

## Journey routes redirect to a step

A journey route does not render a page. Forge redirects the request to a step inside that
journey.

Which step depends on the journey's current state:

- Without resume behaviour, the redirect targets the active entry point. If no step is
  an active entry point, Forge falls back to the first declared step.
- With resume behaviour active and existing progress, the redirect goes to the current
  frontier instead.

This makes the journey URL a stable landing point. A "start this flow" or "continue
where you left off" link can point at it without knowing which step is current.

A step with path `'/'` is an exception. It occupies the same URL as its parent journey and
renders a page there directly.

:::note
---
---
A step mounted on `'/'` sits outside reachability and resume behaviour. It works as a
basic landing page, not as a step that participates in the journey's progression.
:::

## Step routes render pages

A step route is where rendering happens.

Before a step renders, Forge evaluates the surrounding journey context. Access hooks can
stop the request, reachability can redirect the user away, and validation and cleardown
run to keep answers current.

The step does not need to know about the routes around it. Forge reads the surrounding
journey structure to resolve redirect paths, evaluate progress, and decide where the
user can go next.

## Mounted routes and the adapter boundary

Forge does not register framework routes itself. At package registration, Forge exposes
a route topology: the full set of journey and step routes with their paths and methods.
A framework adapter reads that topology and registers the actual routes.

Forge owns the authored route structure. The adapter owns how that structure becomes
Express, Remix, or another framework's routing.

This boundary is invisible while authoring journeys and steps. It surfaces when
debugging a route or tracing why a journey URL redirects instead of rendering a page.
