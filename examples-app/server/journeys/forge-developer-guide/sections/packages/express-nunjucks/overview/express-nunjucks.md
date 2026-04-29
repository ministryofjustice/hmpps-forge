---
title: Express-Nunjucks Adapter
section: packages
path: packages/express-nunjucks/overview
teaches: [express-nunjucks, ExpressFrameworkAdapter]
prerequisites: [packages, journey, step, block]
---

<p class="govuk-caption-xl">Packages</p>

# Express-Nunjucks Adapter
The Express-Nunjucks Adapter package connects Forge to Express.js and the
Nunjucks template engine. It handles routing, request mapping,
state merging, template resolution, and block rendering so that
your journeys render as server-side HTML pages within an Express
application.

{{slot:toc}}

---

## Entry point

```typescript
import {
  ExpressFrameworkAdapter,
  buildNunjucksComponent,
  NunjucksGenerators,
  nunjucksFunctions,
} from '@ministryofjustice/hmpps-forge/express-nunjucks'
```

---

## Setting up the adapter

Pass `ExpressFrameworkAdapter.configure()` as the `frameworkAdapter`
when creating a Forge instance:

```typescript
import nunjucks from 'nunjucks'
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import { ExpressFrameworkAdapter } from '@ministryofjustice/hmpps-forge/express-nunjucks'

const nunjucksEnv = nunjucks.configure(['server/views'], {
  autoescape: true,
  express: app,
})

const forge = new Forge({
  logger,
  frameworkAdapter: ExpressFrameworkAdapter.configure({
    nunjucksEnv,
  }),
})
```

### Configuration options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `nunjucksEnv` | `nunjucks.Environment` | *required* | The Nunjucks environment Forge will use to render page templates and components. This should be the same environment your Express app uses for other views. |
| `defaultTemplate` | `string` | `'form-step'` | The Nunjucks template file to render when neither the step nor any of its ancestor journeys specify a template. The `.njk` extension is appended automatically if not present. |

---

## What's in this section

- [Request & State](request-state) - how the adapter maps Express
  requests into Forge's framework-agnostic model and merges
  `res.locals` with `req.state`.
- [Rendering](rendering) - how templates are resolved, what
  variables are available in the Nunjucks context, and how
  view locals merge.
- [Building Components](building-components) - using
  `buildNunjucksComponent` to create Nunjucks-rendered components
  and how validation errors reach them.
- [Nunjucks Generators](nunjucks-generators) - inline Nunjucks
  template composition with `NunjucksGenerators.String`.
