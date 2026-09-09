---
title: journey()
slug: journey
section: reference
path: reference/journey
nav: Authoring API/Structural
order: 10
description: Defines a journey and its routes, hooks, data, and reachability behaviour
teaches: [journey, path, code, title, steps, children, onAccess, view, data, metadata, reachability]
prerequisites: []
related:
  concept: how-journeys-and-steps-become-routes, packaging-journeys-into-an-app
---

# `journey()`

`journey()` defines a route scope containing steps and child journeys.

```typescript
const travelDeclaration = journey({
  path: '/travel-declaration',
  code: 'travel-declaration',
  title: 'Travel declaration',
  steps: [travelOverviewStep, checkAnswersStep],
})
```

---

## Reference

### `journey(definition)`

Call `journey()` to create a journey definition. The definition becomes part of the route
tree when its package is registered with Forge.

[See more examples below.](#usage)

```typescript
function journey<D extends JourneyDefinition<unknown>>(definition: Omit<D, '_forge'>): D
```

#### Parameters

:::param
---
name: definition
type: Omit<D, '_forge'>
required: true
---
An object describing the journey, its contents, and journey-wide behaviour. Its
properties are listed below.
:::

#### Definition properties

:::param
---
name: path
type: string
required: true
---
The journey's route path, such as `'/travel-declaration'`. Step and child journey paths
append to it, composing from the root journey downwards. The path can contain route
parameters, such as `/applications/:applicationId`.

Forge combines this path with its ancestor paths before checking for conflicts. If the
resulting route conflicts with another journey or step, Forge reports
`Duplicate route path` and does not register the package.

[Learn how journeys and steps become routes.](../concepts/how-journeys-and-steps-become-routes)
:::

:::param
---
name: code
type: string
required: true
---
The journey's identifier. Forge uses the root journey's code to identify the package in
diagnostics and traces. Every journey ancestor exposes its code in the rendering
context.
:::

:::param
---
name: title
type: ResolvableString
required: true
---
The human-readable journey title. Forge evaluates it for the current request and
includes it in the route tree and the journey ancestor's rendering context. Accepts a
plain string or a string expression such as
`Format('Travel declaration for %1', Data('travellerName'))`.
:::

:::param
---
name: description
type: ResolvableString
required: false
---
A description evaluated for the current request and included in the route tree.
:::

:::param
---
name: steps
type: StepDefinition[]
required: false
---
The [steps](./step) directly contained by the journey, in declaration order. A journey can omit
`steps` when it only groups child journeys. Declaration order is the final [tie-breaker](./tie-breaker)
between equally prioritised reachability candidates. The first declared step is also the
fallback when the journey has no active entry point.

[See defining a journey with steps below.](#define-a-journey-with-steps)
:::

:::param
---
name: children
type: JourneyDefinition[]
required: false
---
Journeys nested directly beneath this journey. Each child's path is appended to the
paths of its ancestors.

[See grouping a nested route section below.](#group-a-nested-route-section)
:::

:::param
---
name: onAccess
type: AccessHook[]
required: false
---
[Access hooks](./access) inherited by this journey's steps and child journeys. When omitted, this
journey adds no hooks; hooks inherited from ancestor journeys still run.

[See applying access hooks and data below.](#apply-access-hooks-and-data-to-descendants)
:::

:::param
---
name: renderer
type: RendererInvocation
required: false
---
An invocation produced by [`renderer()`](./renderer). Its factory receives
request dependencies, and its evaluator receives rendered children, resolved props,
and step context. Nested blocks render before the step renderer runs.
Descendant steps inherit this renderer unchanged unless they declare their own.
When omitted, this journey adds no renderer override.
:::

:::param
---
name: view
type: ViewConfig
required: false
---
Rendering configuration inherited by this journey's descendants. Forge combines view
configuration from the root journey inwards, followed by the current step, and passes the
effective result to the renderer. When omitted, this journey adds no template or locals
of its own.
:::

:::param
---
name: template
parent: view
type: string
required: false
---
A template identifier made available to the renderer. The nearest template declared by
the current step or one of its journey ancestors wins. When none is declared, the
effective view has no template and the renderer can choose a fallback.
:::

:::param
---
name: locals
parent: view
type: Record<string, unknown>
required: false
---
Values made available to the renderer for use as template locals. Forge merges locals
from the root journey inwards, followed by the current step, so nearer values replace
values with the same key. When omitted, this journey adds no locals of its own.
:::

<!-- TODO: Link to the Express-Nunjucks adapter documentation once it exists. -->
[See how the Express-Nunjucks adapter renders the effective view configuration.](#)

:::param
---
name: data
type: Record<string, unknown>
required: false
---
Static data available through [`Data()`](./data) while Forge evaluates this journey and its
descendants. Forge merges data from the root journey inwards, so nearer journeys and the
current step replace values with the same key.

Values must be JSON-compatible and cannot contain Forge expressions such as `Data()`, `Answer()`, or `Query()`; load request-specific
values in an access-hook effect instead.

[See applying access hooks and data below.](#apply-access-hooks-and-data-to-descendants)
:::

:::param
---
name: metadata
type: RouteMetadata
required: false
---
Additional route information keyed by name, such as `navGroup: 'Declarations'`. Values
can be static or value expressions. Forge evaluates them for the current request and
exposes them on the journey's route-tree entry and journey ancestor rendering context.
:::

:::param
---
name: reachability
type: JourneyReachability
required: false
---
Journey-level resume and unreachable-route behaviour. When omitted, resume behaviour is
inactive and unreachable routes redirect to the active entry point.

[See controlling resume and unreachable behaviour below.](#control-resume-and-unreachable-behaviour)
:::

:::param
---
name: resumeWhen
parent: reachability
type: true | PredicateExpr | PredicateTestExprBuilder
required: false
---
Activates resume behaviour when set to `true`, or while the predicate passes. It can
redirect a journey request or step `GET`, but never interrupts a step `POST`.
:::

:::param
---
name: unreachableRedirect
parent: reachability
type: 'entry' | 'frontier'
required: false
---
Where unreachable routes redirect: the active entry point, or the current frontier with
an entry-point fallback. Defaults to `'entry'`; not inherited by child journeys.
:::

:::param
---
name: disableReachabilityChecks
parent: reachability
type: boolean
required: false
---
When `true`, Forge treats the journey's steps as reachable. Child journeys inherit the
setting and can set it to `false` to restore checks.
:::

#### Returns

`journey()` returns a journey definition ready to register as a package root or add to
another journey's `children` array.

#### Caveats

- Journey step order affects routing behaviour. When no step is an active entry point,
  Forge uses the first declared step as the fallback. Declaration order is also the final
  tie-breaker between equally prioritised reachability candidates.

- `disableReachabilityChecks` is inherited by child journeys. A child journey can set it
  to `false` to restore reachability checks, but otherwise all descendant steps are
  treated as reachable.

- Journey and step structure cannot be generated or changed at request time. Iterators,
  generator functions, and expressions can produce values inside a registered route, but
  cannot produce routes themselves. Forge registers stable paths and computes
  reachability from that structure. Use path parameters, access hooks, redirects, and
  reachability rules to vary the request.

---

## Usage

### Define a journey with steps

Create the steps separately, then list them in journey order:

```typescript
const startStep = step({
  path: '/start',
  title: 'Start your declaration',
  reachability: { entryWhen: true },
  blocks: [GovUKButton({ text: 'Start now' })],
})

const checkAnswersStep = step({
  path: '/check-answers',
  title: 'Check your answers',
  blocks: [checkAnswersSummary, GovUKButton({ text: 'Submit' })],
})

const travelDeclaration = journey({
  path: '/travel-declaration',
  code: 'travel-declaration',
  title: 'Travel declaration',
  steps: [startStep, checkAnswersStep],
})
```

The order you declare steps in matters twice: it is the final tie-breaker when two steps
are equally prioritised reachability candidates, and the first declared step is the
journey's fallback when no step is an active entry point. Put the natural first page of
the journey first.

For how journey and step paths compose, see
[How journeys and steps become routes](../concepts/how-journeys-and-steps-become-routes).

### Apply access hooks and data to descendants

Put an access hook or static data on the journey when its descendants share them:

```typescript
const travelDeclaration = journey({
  path: '/travel-declaration',
  code: 'travel-declaration',
  title: 'Travel declaration',
  onAccess: [
    access({
      effects: [TravelEffects.LoadTraveller()],
    }),
  ],
  data: {
    maxTrips: 10,
  },
  steps: [travelOverviewStep, checkAnswersStep],
})
```

Forge runs access hooks from the root journey inwards, followed by the current step's
hooks, before the request continues to answer preparation, reachability, or rendering. A
redirect or error outcome stops the remaining request processing. Every descendant can
read `maxTrips` with `Data('maxTrips')`.

### Group a nested route section

Add a child journey when a nested section needs its own route scope or journey-wide
behaviour:

```typescript [[1, 2, "path: '/trips'"], [1, 5, "steps: [listTripsStep, addTripStep]"], [2, 12, "children: [tripsJourney]"]]
const tripsJourney = journey({
  path: '/trips',
  code: 'travel-declaration-trips',
  title: 'Trips',
  steps: [listTripsStep, addTripStep],
})

const travelDeclaration = journey({
  path: '/travel-declaration',
  code: 'travel-declaration',
  title: 'Travel declaration',
  children: [tripsJourney],
})
```

The <s1>child journey's path and steps</s1> define the nested route
scope. Adding it to <s2>the parent journey's `children`</s2> mounts
that scope beneath `/travel-declaration`, so the `/add` step is available at
`/travel-declaration/trips/add`.

A child journey can also have its own child journeys, access hooks, data, view, metadata,
and reachability behaviour.

For the full path-composition model, see
[How journeys and steps become routes](../concepts/how-journeys-and-steps-become-routes).

### Control resume and unreachable behaviour

Set `reachability` when a journey should return a user with progress to where they left
off, or send unreachable requests somewhere other than the entry point:

```typescript
const travelDeclaration = journey({
  path: '/travel-declaration',
  code: 'travel-declaration',
  title: 'Travel declaration',
  reachability: {
    resumeWhen: Query('resume').match(Condition.Equals('true')),
    unreachableRedirect: 'frontier',
  },
  steps: [startStep, addTripStep, checkAnswersStep],
})
```

While `resumeWhen` passes, Forge can redirect a journey request or a step `GET` for a
user with progress to the current frontier. With `unreachableRedirect: 'frontier'`,
requests for steps the user cannot reach yet go to the frontier too, falling back to the
entry point when there is no progress.

---

## Troubleshooting

### Forge reports `Duplicate route path`

Two journeys or steps have composed to the same route. Check the `path` of each journey
and step in the reported branch; child paths are appended to every ancestor journey path.

Give each route a distinct composed path. A step with the path `/` is allowed to occupy
its parent journey's composed route when that overlap is deliberate.

### Forge reports `Forge expressions are not supported in static data`

The `data` object contains an expression such as `Data()`, `Answer()`, or `Query()`.
Journey data is static and is validated when the package is registered.

Replace the expression with a literal value, or load the request-specific value in an
access-hook effect and write it with `context.setData()`.
