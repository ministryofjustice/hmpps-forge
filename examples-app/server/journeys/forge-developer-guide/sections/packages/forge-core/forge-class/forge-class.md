---
title: Initialisation
section: packages
path: packages/forge-core/forge-class
teaches: [Forge, ForgeOptions, ForgePackage, registerPackage, registerGlobalComponents, registerGlobalFunctions, getRouter, createForgePackage]
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
import { ExpressFrameworkAdapter } from '@ministryofjustice/hmpps-forge/express-nunjucks'

const forge = new Forge({
  frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
  logger,
})
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `frameworkAdapter` | `FrameworkAdapterBuilder` | *required* | Builder for the web framework adapter. Use the static `configure()` method on your adapter class. |
| `logger` | `Logger \| Console` | `console` | Logger instance for Forge output. Compatible with pino, bunyan, or any logger with `info`, `error`, `warn`, and `debug` methods. |
| `basePath` | `string` | `''` | Base path prefix for all routes. When set, all routes are mounted under this path and the route tree includes the prefix. |
| `strictRegistration` | `boolean` | `true` | When `true`, registration errors throw immediately. When `false`, errors are logged and the failing journey is skipped. |
| `lazyStepCompilation` | `boolean` | `true` | When `true`, each step compiles on first request for faster startup. When `false`, all steps compile at registration time for faster first requests. |
| `disableBuiltInFunctions` | `boolean` | `false` | Skip registering built-in conditions, transformers, and effects. |
| `disableBuiltInComponents` | `boolean` | `false` | Skip registering built-in components (HtmlBlock, CollectionBlock, TemplateWrapper). |
| `debug` | `boolean` | `false` | Enable debug logging for compilation and evaluation. |

---

## Registering journeys

### register()

Register a single journey definition:

```typescript
forge.register(myJourney)
```

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
without polluting the global registries.

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
  functions: myEffectImplementations,
  components: [myCustomComponent],
  enabled: true,
})
```

| Property | Type | Description |
|----------|------|-------------|
| `journey` | `JourneyDefinition` | The journey definition (required). |
| `functions` | `FunctionImplementations` | Custom effect, condition, transformer, and generator implementations. |
| `components` | `ComponentRegistryEntry[]` | Custom components scoped to this journey. |
| `enabled` | `boolean` | Whether to register the package. Defaults to `true`. |

---

## Registering global components and functions

Components and functions registered globally are available to
all journeys:

```typescript
import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
import { nunjucksFunctions } from '@ministryofjustice/hmpps-forge/express-nunjucks'

forge
  .registerGlobalComponents(govukComponents(nunjucksEnv))
  .registerGlobalFunctions(nunjucksFunctions)
```

You can also register a single component:

```typescript
forge.registerGlobalComponent(myComponent)
```

All registration methods return `this`, so they can be chained.

---

## Getting the router

Once all journeys are registered, get the framework router and
mount it on your application:

```typescript
const router = forge.getRouter() as express.Router

app.use(router)
```

If you configured a `basePath`, the routes are already prefixed:

```typescript
const forge = new Forge({
  basePath: '/forms',
  frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
})

// Routes will be at /forms/my-journey/step-one, etc.
app.use(forge.getRouter() as express.Router)
```
