---
title: Using Forge in your app
section: get-started
path: get-started/using-forge-in-your-app
teaches: [Forge, createExpressRouter, registerPackage]
prerequisites: [installation]
---

<p class="govuk-caption-xl">Get started</p>

# Using Forge in your app
Forge has two setup steps: create an instance and register your
journey packages.

{{slot:toc}}

---

## Create a Forge instance

Create a Forge instance and register your journey packages. Forge
itself is framework-agnostic - connecting it to Express happens
separately via `createExpressRouter`.

```typescript
import { Forge } from '@ministryofjustice/hmpps-forge/core'

const forge = new Forge({ logger })
```

The next guide,
[Using Forge with Express and Nunjucks](using-forge-with-express-and-nunjucks), covers
how to create the Express router and wire everything together.

---

## Component libraries register themselves

There is no separate registration step for component libraries.
Building a block with a component like `GovUKTextInput`,
`GovUKRadioInput`, or `GovUKButton` in a journey definition
registers that component for the journey's package automatically.

The same applies to your own custom components and to functions
declared with `condition()`, `transformer()`, and friends - using
one is registering it.

---

## Register journey packages

Each journey is bundled into a package and registered with Forge.
You will create your first package in the
[Creating your first journey](creating-your-first-journey) guide, but
the registration call looks like this:

```typescript
import myJourneyPackage from './journeys/my-journey'

forge.registerPackage(myJourneyPackage)
```

If a package depends on external services, pass them as the second
argument:

```typescript
forge.registerPackage(myJourneyPackage, {
  myApi: services.myApi,
  dataStore: services.dataStore,
})
```

Forge injects these dependencies into your effect functions at
runtime. This keeps your journey definitions free of direct service
references.

---

## What is next

You now have a Forge instance with your journeys registered.
Continue to [Using Forge with Express and Nunjucks](using-forge-with-express-and-nunjucks)
to create the Express router and wire Forge into your web application.
