---
title: Installing Forge
slug: installing-forge
section: get-started
path: get-started/installing-forge
nav: Installation
order: 10
description: Install the Forge package, create an instance, and register components and journeys
teaches: [installation, Forge, registerGlobalComponents, registerPackage]
prerequisites: []
---

# Installing Forge

This page walks through installing the Forge package, creating an instance, and registering the component libraries and journey packages your application needs. By the end you'll have a Forge instance ready to be connected to a web framework.

## What you need

Before you start, make sure you have:

- **Node.js** version 20 or later
- **npm** (included with Node.js)
- A working knowledge of **TypeScript**

You don't need prior experience with Forge. These guides assume you're setting it up for the first time.

## Install the package

Install Forge from npm:

```bash
npm install @ministryofjustice/hmpps-forge
```

Forge ships its own TypeScript types, so there's no separate `@types` package to install.

## Create a Forge instance

The entry point is a Forge instance. This is where you register component libraries and journey packages. Forge itself is framework-agnostic; connecting it to a web framework happens separately through an adapter.

```typescript
import { Forge } from '@ministryofjustice/hmpps-forge/core'

const forge = new Forge({ logger })
```

## Register component libraries

Forge needs to know about the component libraries your journeys will use. Register them after creating the instance:

```typescript
import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
import { mojComponents } from '@ministryofjustice/hmpps-forge/moj-components'

forge.registerGlobalComponents(govukComponents)
forge.registerGlobalComponents(mojComponents)
```

This makes components like `GovUKTextInput`, `GovUKRadioInput`, and `GovUKButton` available in your journey definitions. You can register as many libraries as you need, including your own.

## Register journey packages

A package bundles a journey with the function registries and components it needs. You create one with `createForgePackage`:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { myJourney } from './journey'
import { myEffectRegistry } from './effects'

export default createForgePackage({
  journey: myJourney,
  functions: [myEffectRegistry],
})
```

Then register it with the Forge instance:

```typescript
forge.registerPackage(myPackage)
```

If a package depends on external services, pass them as the second argument:

```typescript
forge.registerPackage(myPackage, {
  myApi: services.myApi,
  dataStore: services.dataStore,
})
```

Forge injects these dependencies into your functions at runtime. That keeps your journey definitions free of direct service references.

## What's next

You now have a Forge instance with component libraries and journey packages registered. Continue to [Install frontend libraries](install-frontend-libraries) to add the template packages Forge renders with, or skip ahead to [Using Forge with Express and Nunjucks](using-forge-with-express-and-nunjucks) to wire Forge into your web application.
