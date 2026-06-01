---
title: Using Forge in your app
section: get-started
path: get-started/using-forge-in-your-app
teaches: [Forge, createExpressRouter, registerGlobalComponents, registerPackage]
prerequisites: [installation]
---

<p class="govuk-caption-xl">Get started</p>

# Using Forge in your app
Forge has three setup steps: create an instance, register your
component libraries, and register your journey packages.

{{slot:toc}}

---

## Create a Forge instance

Create a Forge instance and register your component libraries and
journey packages. Forge itself is framework-agnostic — connecting
it to Express happens separately via `createExpressRouter`.

```typescript
import { Forge } from '@ministryofjustice/hmpps-forge/core'

const forge = new Forge({ logger })
```

The next guide,
[Using Forge with Express and Nunjucks](using-forge-with-express-and-nunjucks), covers
how to create the Express router and wire everything together.

---

## Register component libraries

Forge needs to know about the component libraries your journeys will
use. Register them after creating the Forge instance:

```typescript
import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
import { mojComponents } from '@ministryofjustice/hmpps-forge/moj-components'

forge.registerGlobalComponents(govukComponents)
forge.registerGlobalComponents(mojComponents)
```

This makes components like `GovUKTextInput`, `GovUKRadioInput`, and
`GovUKButton` available for use in your journey definitions.

You can register as many component libraries as you need, including
your own custom components.

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

You now have a Forge instance with component libraries registered.
Continue to [Using Forge with Express and Nunjucks](using-forge-with-express-and-nunjucks)
to create the Express router and wire Forge into your web application.
