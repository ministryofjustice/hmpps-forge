---
title: Initialisation
section: packages
path: packages/forge-core/forge-class
teaches: [Forge, ForgeOptions, ForgePackage, registerPackage, createForgePackage]
prerequisites: [forge-core]
---

<p class="govuk-caption-xl">Forge Core</p>

# Initialisation
The `Forge` class is the main entry point for setting up the
engine. It manages journey registration, component and function
registries, and produces the router you mount on your web
application.

{{slot:toc}}

---

## Creating an instance

```typescript
import { Forge } from '@ministryofjustice/hmpps-forge/core'

const forge = new Forge({ logger })
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logger` | `Logger \| Console` | `console` | Logger instance for Forge output. Compatible with pino, bunyan, or any logger with `info`, `error`, `warn`, and `debug` methods. |
| `basePath` | `string` | `''` | Base path prefix for all routes. When set, all routes are mounted under this path and the route tree includes the prefix. |
| `strictRegistration` | `boolean` | `true` | When `true`, registration errors throw immediately. When `false`, errors are logged and the failing journey is skipped. |
| `debug` | `boolean` | `false` | Enable debug logging for compilation and evaluation. |
| `instrumentation` | `ForgeInstrumentationOptions` | `{}` | Trace sinks for request and compilation diagnostics, plus an opt-in flag to capture generated source on compilation traces. |

---

## Registering packages

### registerPackage()

Register a self-contained package that bundles a journey with
its custom functions and components:

```typescript
forge.registerPackage(myPackage, {
  api: services.apiClient,
  dataStore: services.dataStore,
})
```

When a package includes custom functions or components, Forge
creates scoped registries so they are available to that journey
without becoming visible to any other journey.

Packages can be conditionally disabled:

```typescript
forge.registerPackage(createForgePackage({
  enabled: config.featureFlags.myFormEnabled,
  journey: myJourney,
}))
```

---

## ForgePackage

A `ForgePackage` bundles a journey definition with its custom
registries. Use `createForgePackage()` to create one:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'

export const myPackage = createForgePackage({
  journey: myJourney,
  functions: myEffects,
  components: [myCustomComponent],
  enabled: true,
})
```

| Property | Type | Description |
|----------|------|-------------|
| `journey` | `JourneyDefinition` | The journey definition (required). |
| `functions` | `Registry \| FunctionEntry \| (Registry \| FunctionEntry)[]` | Function registries and entries, including component and renderer declarations, scoped to this journey. |
| `components` | `FunctionEntry[]` | Deprecated compatibility listing for component declarations. Prefer `functions`. |
| `enabled` | `boolean` | Whether to register the package. Defaults to `true`. |

---

## Where components and functions come from

There is no global registration step. Every component and
function a journey uses arrives through its package:

- Entries declared with `component()`, `renderer()`, `condition()`, and the
  other function helpers register themselves - using one in
  the journey definition is enough.
- Journeys that reference a variant or function by string only
  (a JSON journey, for example) list what they need on the
  package's `functions` property.

Core exports `builtInFunctions` and `builtInComponents` for a
name-only package that needs the complete built-in sets:

```typescript
import { builtInFunctions, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { builtInComponents } from '@ministryofjustice/hmpps-forge/core/components'

createForgePackage({
  journey: jsonJourney,
  functions: [...builtInFunctions],
  components: [...builtInComponents],
})
```

`registerPackage()` returns `this`, so registrations chain.

---

## Creating the Express router

Once all journeys are registered, use `createExpressRouter` to
produce an Express router and mount it on your application:

```typescript
import { createExpressRouter } from '@ministryofjustice/hmpps-forge/express-nunjucks'

app.use(createExpressRouter(forge, { nunjucksEnv }))
```

If you configured a `basePath`, the routes are already prefixed:

```typescript
const forge = new Forge({
  basePath: '/forms',
  logger,
})

// Routes will be at /forms/my-journey/step-one, etc.
app.use(createExpressRouter(forge, { nunjucksEnv }))
```
