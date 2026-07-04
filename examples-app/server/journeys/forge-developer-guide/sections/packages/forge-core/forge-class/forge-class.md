---
title: Initialisation
section: packages
path: packages/forge-core/forge-class
teaches: [Forge, ForgeOptions, ForgePackage, registerPackage, registerGlobalComponents, registerGlobalFunctions, createForgePackage]
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
| `disableBuiltInFunctions` | `boolean` | `false` | Skip registering built-in conditions, transformers, and effects. |
| `disableBuiltInComponents` | `boolean` | `false` | Skip registering built-in components (HtmlBlock, CollectionBlock, TemplateWrapper). |
| `debug` | `boolean` | `false` | Enable debug logging for compilation and evaluation. |

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
  functions: myEffects,
  components: [myCustomComponent],
  enabled: true,
})
```

| Property | Type | Description |
|----------|------|-------------|
| `journey` | `JourneyDefinition` | The journey definition (required). |
| `functions` | `Registry \| Registry[]` | One or more function registries (`EffectRegistry`, `ConditionRegistry`, `TransformerRegistry`, `GeneratorRegistry`) holding your custom implementations. A deprecated implementations map is also accepted. |
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

`registerGlobalFunctions()` accepts a single function registry, an
array of registries, or (deprecated) an implementations map. Pass
any dependencies those functions need as the second argument:

```typescript
forge.registerGlobalFunctions([myConditions, myTransformers], { api: services.apiClient })
```

You can also register a single component:

```typescript
forge.registerGlobalComponent(myComponent)
```

All registration methods return `this`, so they can be chained.

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
