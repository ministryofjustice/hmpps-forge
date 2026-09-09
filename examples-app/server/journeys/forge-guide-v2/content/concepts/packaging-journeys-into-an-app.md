---
title: Packaging journeys into an app
slug: packaging-journeys-into-an-app
section: concepts
path: concepts/packaging-journeys-into-an-app
nav: Routes and application structure
order: 21
description:
  How packages, registries, adapters, topology, and framework integration make journeys
  available in an application
teaches:
  [packages, registries, package-scoping, adapters, framework-integration, topology]
prerequisites:
  [how-journeys-and-steps-become-routes, how-blocks-resolution-and-rendering-connect]
related:
  concept:
    [
      returning-a-page-redirect-or-error,
      how-forge-runs-a-request,
    ]
  reference: [create-forge-package]
---

# Packaging journeys into an app

A Forge journey becomes useful when an application registers it.

The journey describes the flow, and the package brings that journey together with the
functions and components it needs. The app then registers the package, supplies
dependencies, and connects a framework adapter that turns Forge outcomes into real
responses.

Packaging is the boundary between authoring a journey and running it inside a service.

## A package is the unit the app registers

A package can be as small as a journey:

```ts
createForgePackage({
  journey: applyForLicenceJourney,
});
```

Functions and components called in the journey carry their entries into the definition.
`createForgePackage()` collects those entries automatically, so the package doesn't need
to list them separately.

A JSON journey carries names instead of entries. Its package supplies the implementations
those names refer to:

```ts
createForgePackage({
  journey: applyForLicenceJourneyJson,
  functions: [SaveApplication, ApplicationSummary],
});
```

When the app registers the package, Forge checks the journey and prepares its routes,
functions, components, and metadata for requests.

That early registration step lets Forge report setup problems and stop the package from
registering before a user reaches the journey.

## Calls connect the journey to its implementations

Calling a function or component in a journey creates a definition and carries the entry
that implements it. `SaveApplication()` describes an effect to run, while
`GovUKTextInput(...)` describes a field to render. Neither call performs that work during
authoring.

Package creation collects those entries, and registration checks that the journey's
references resolve. The journey stays declarative because it describes the work, while
the evaluators run later with the current request's values and dependencies.

## Package-local entries keep journeys self-contained

Some functions and components belong to one journey package. A package-local effect can
call a service that only one journey uses, and a package-local component can render a
specialist panel that has no place in a shared component library. Registering them on the
package keeps those pieces near the journey that needs them.

Shared libraries follow the same model. Each package collects the shared functions and
components used in its journey, alongside its specialist entries. Registrations belong to
the package, so registering an entry in one package doesn't make it available to another.

The implementation can be shared across the app while each package carries the entries
its journey needs.

## Dependencies are supplied by the app

Project functions depend on application services. An effect that saves an application, for
example, needs a case API or an audit logger. The app supplies those services when it
registers the package, so the journey definition never creates them itself.

```ts
forge.registerPackage(applyForLicencePackage, {
  caseApi,
  auditLogger,
});
```

The journey stays portable because it describes the effect. The app stays in control of
real services because it supplies the dependencies.

## The adapter owns framework details

Forge doesn't need to know whether the app uses Express, Remix, or another framework.

The adapter translates between the framework and Forge. It creates the request snapshot,
passes route params, query values, post data, session, headers, cookies, and
adapter-managed state into Forge, then turns the Forge outcome into the framework
response. The app still owns loading saved journey answers before Forge needs them.

That boundary separates two domains. Journey paths, answers, validation, reachability, and
rendering context live inside Forge. HTTP response writing, session storage, cookies,
persistence, and framework middleware live in the app or adapter.

## Topology is the mounted shape of the app

When packages are registered, Forge learns the mounted shape of journeys and steps. That
shape lets it match requests, build route data, resolve journey roots, and detect
conflicting mounted paths.

Authors experience the same shape through routes: a journey has a base path and steps
appear underneath it. The app and adapter use the same shape to send the right requests
into Forge.

Topology emerges from registered packages and mounted routes rather than from manual
modeling.

## Packages can be optional

Some journeys only belong in certain environments or behind feature flags. A package can
be disabled so registration skips it.

```ts
createForgePackage({
  enabled: config.features.applyForLicence,
  journey: applyForLicenceJourney,
});
```

This keeps optional journeys out of the mounted app without scattering feature checks
through the journey definition.

## The app owns the outside world

Forge owns journey evaluation. The app owns everything outside that boundary:

- framework request and response objects
- persistence and answer loading
- sessions, cookies, and headers
- external services used by effects
- shared component and function libraries
- final response writing

That split is what makes Forge useful as a journey engine rather than a whole web
framework. Authors can write flows in Forge terms while the service keeps control of the
platform it runs on.
