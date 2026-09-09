---
title: Why Forge does not own your domain
slug: why-forge-does-not-own-your-domain
section: concepts
path: concepts/why-forge-does-not-own-your-domain
nav: Inside the engine
order: 25
description:
  How Forge stays out of the service domain, and how effects, context, and the snapshot
  keep domain-specific work in the application
teaches:
  [
    domain-boundary,
    effects,
    integration-through-context,
    stateless-evaluation,
    response-bindings,
  ]
prerequisites:
  [how-forge-runs-a-request, packaging-journeys-into-an-app]
related:
  concept:
    [
      why-forge-splits-evaluation-from-the-adapter,
      how-answers-work,
      how-expressions-work,
    ]
---

# Why Forge does not own your domain

Forge evaluates journeys. It decides which step to show, what validation to run, which
answers to prepare, and whether to redirect or render.

It does not know what the application does. Forge never fetches a record from an API, saves
data to a store, checks permissions, or calls an external system. The application owns all
domain work.

## Forge orchestrates when, the app owns what

The engine controls the sequence of a request: access hooks run first, then answer
preparation, then validation, then reachability, and so on. Each phase runs at a
predictable point in the pipeline.

The work inside those phases belongs to the application: loading a case, saving an
application, checking a licence, writing an audit record. Forge provides the hook. The
application provides the effect.

That split is not an accident. The same engine can evaluate any journey, regardless of what
the application does. The engine does not carry dependencies on specific APIs, databases, or
domain models.

## Effects carry domain work into hooks

Effects are the only place where application side effects enter Forge. Semantic analysis
rejects an effect used anywhere other than a hook at compile time.

Forge ships zero built-in effects. Every effect is application-authored:

```ts
const saveApplication = effect("saveApplication", {
  factory: (deps) => async (context) => {
    await deps.api.save(context.getAllAnswers());
  },
});
```

The application injects its dependencies at registration:

```ts
forge.registerPackage(applyPackage, {
  api: caseApiClient,
});
```

At runtime, Forge calls the effect and continues. It does not inspect the return value. The
effect runs for its side effect alone. If the request needs to redirect or error after the
effect, a declared outcome handles that decision. The effect itself does not decide the
outcome.

This keeps effects opaque to the engine. Forge knows that an effect runs at this point in
the pipeline. It does not know what the effect does.

## Data arrives through context, not through Forge

Forge starts every request with empty answer and data stores. Two sources fill them.

**Static data** is declared on journeys and steps. Forge clones it fresh per request during
context preparation.

```ts
journey({
  code: "apply",
  path: "/apply",
  title: "Apply",
  data: { maxFileSize: 10, allowedTypes: ["pdf", "jpg"] },
  steps: [detailsStep],
});
```

**Request-loaded data** enters through access hook effects. The application calls
`context.setData()` or `context.setAnswer()` to populate the stores before the rest of the
pipeline reads them.

```ts
access({
  effects: [loadCase(), loadSavedAnswers()],
});
```

After access hooks run, expressions read both sources through `Data("caseName")` and
`Answer("emailAddress")`. Forge resolves those references from the populated context. It
does not initiate the load.

The same pattern applies to answers. Forge does not have an answer store. On each request,
answers arrive empty. Access hooks load saved answers from the application's store. Answer
preparation then layers submitted values, defaults, formatters, and dependency clearing on
top.

:::deep-dive
---
title: The serialisability guard at the boundary
description: Values that cross into Forge must be plain data. Domain objects cannot leak into engine state.
summary: Show the serialisability guard
---

`setAnswer` and `setData` reject functions, class instances, symbols, bigints, and dates.
They accept plain data and `undefined` for absent values.

This prevents domain objects from crossing the boundary. An API response or database record
must be reduced to plain data before Forge accepts it. The application decides what shape
that data takes. Forge only requires that it is serialisable.

The same constraint applies to answers. A field's prepared value, after formatting and
parsing, stays as plain data in the answer history.
:::

## The snapshot carries application state

The request snapshot contains two fields that carry application-managed state into Forge
without Forge understanding what they hold.

**`state`** is adapter-managed request state. The Express adapter populates it from
`app.locals`, `res.locals`, and any request-level state. User identity, authentication
results, feature flags, and middleware-populated context arrive here. Forge reads this state
through expressions like `Request.State("userId")` but never writes to it.

**`session`** is typed `unknown` to the engine. The adapter passes it by reference. Effects
can read it through `context.getSession()`, and expressions can read it through
`Session("key")`. The adapter owns session persistence. Forge does not save sessions, set
session cookies, or manage session stores.

Both fields enter as opaque data. Forge treats them the same way it treats route params or
query values: readable context that the application provided.

## The app decides what to persist

Forge has no persistence layer.

The application persists answers after a valid submission. An effect in a submit hook calls
the application's API, store, or session manager:

```ts
submit({
  validate: true,
  onValid: {
    effects: [saveAnswersToSession()],
    next: [redirect({ goto: "check-answers" })],
  },
});
```

Even answer cleardown is advisory on the persistence side. When reachability determines
that a branch is no longer on the user's path, Forge clears those answers from its own
request-scoped state. It also makes the list available through
`context.getFieldsToClear()`, so the application can mirror the deletion in its own store.
Forge does not reach into the store itself.

## Shared packages grow from the same split

Because domain work lives in functions and effects rather than inside the engine, teams can
package that work and share it.

A team that writes a set of validation conditions for date fields, address formatting, or
National Insurance number checks can publish those functions as a library. Journeys can
call those functions, and each journey's package collects the entries with no engine changes.

The same applies across the extension surface:

- **Conditions, transformers, and generators** package reusable evaluation logic. A shared
  date-formatting transformer or an eligibility condition works in any journey that
  uses it.
- **Effects** package reusable integrations. An audit-logging effect, a case-API save
  effect, or a notification effect can serve multiple journeys across teams.
- **Components** package reusable rendering. A specialist summary card or a file-upload
  component can be used across journeys, with each journey's package collecting its entry.
- **Journeys and steps** are themselves shareable. A package can contain a complete journey
  definition alongside the functions and components it needs, ready to register into a
  different application.

Forge does not prescribe how teams organise these packages. The extension model provides
the boundary: named functions, named components, and scoped registries. Teams decide what
to share, how to version it, and where to publish it.

That reuse is a direct consequence of the domain split. If Forge owned the integrations,
every shared package would carry the engine's opinion about how to call an API or render a
component. Because Forge stays out, packages carry only the logic and its registry contract.

## Why this matters

**Portability.** The same engine evaluates any journey, regardless of domain. Forge does not
carry dependencies on specific APIs, domain models, or data shapes.

**Testability.** Tests supply answers and data directly. No API clients, databases, or
external services need to exist.

**Predictability.** Given the same definition and the same request state, Forge makes the
same journey decision. Domain-specific behaviour lives in effects, which are injected and
replaceable.

The application owns its domain. Forge owns the journey evaluation model. Effects, context,
and the snapshot are the three channels between them.
