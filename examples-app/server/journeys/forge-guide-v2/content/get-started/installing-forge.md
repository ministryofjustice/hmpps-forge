---
title: Installing Forge
slug: installing-forge
section: get-started
path: get-started/installing-forge
nav: Installation
order: 10
description: Install the Forge package, create an instance, and register journey packages
teaches: [installation, Forge, component-self-registration, registerPackage]
prerequisites: []
---

# Installing Forge

This page walks through installing the Forge package, creating an instance, and registering the journey packages your application needs. By the end you'll have a Forge instance ready to be connected to a web framework.

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

The entry point is a Forge instance. This is where you register journey packages. Forge itself is framework-agnostic; connecting it to a web framework happens separately through an adapter.

```typescript
import { Forge } from '@ministryofjustice/hmpps-forge/core'

const forge = new Forge({ logger })
```

## Use components in your journey

Import the component builders your journey needs and call them in its step definitions:

```typescript
import { GovUKTextInput } from '@ministryofjustice/hmpps-forge/govuk-components'

const fullName = GovUKTextInput({
  code: 'fullName',
  label: 'Full name',
})
```

Add the resulting block to a step's `blocks` array. Components self-register when
called in a journey, and package creation collects their entries automatically.
The same applies to MOJ components and your own component builders; there is no
separate component-library registration call.

## Register journey packages

A package bundles a journey with the functions and components it uses. Create one
with `createForgePackage`, which collects the entries called in the journey:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { myJourney } from './journey'

const myPackage = createForgePackage({
  journey: myJourney,
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

You now have a Forge instance with its journey packages registered. Continue to [Install frontend libraries](install-frontend-libraries) to add the template packages Forge renders with, or skip ahead to [Using Forge with Express and Nunjucks](using-forge-with-express-and-nunjucks) to wire Forge into your web application.
