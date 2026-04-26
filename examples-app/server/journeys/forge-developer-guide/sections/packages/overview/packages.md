---
title: Packages
section: packages
path: packages/overview
teaches: [packages, forge-core, govuk-components, moj-components]
prerequisites: [journey, step, block]
---

<p class="govuk-caption-xl">Packages</p>

# Packages
Forge ships as a single npm package with multiple entry points. Each
entry point targets a different layer of the framework: the core
engine, the GOV.UK Design System components, and the Ministry of
Justice components.

{{slot:toc}}

---

## What is a package?

A Forge package is a set of exports grouped by concern. The core
package provides the engine, authoring API, and compilation pipeline.
The component packages provide pre-built blocks that render HTML
following the GOV.UK and MOJ design systems.

You import from the entry point that matches what you need:

```typescript
import { journey, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKTextInput } from '@ministryofjustice/hmpps-forge/govuk-components'
import { MOJBanner } from '@ministryofjustice/hmpps-forge/moj-components'
```

---

## Available packages

- [Forge Core](forge-core) - the engine, authoring builders,
  compilation, and runtime. Everything you need to define and run
  journeys.
- [Express-Nunjucks Adapter](express-nunjucks) - the framework adapter
  that connects Forge to Express.js and the Nunjucks template engine.
  Handles routing, state merging, template resolution, and block
  rendering.
- [GOV.UK Components](govuk-components) - pre-built blocks for the
  GOV.UK Design System: text inputs, radios, checkboxes, date inputs,
  summary lists, panels, and more.
- [MOJ Components](moj-components) - pre-built blocks for the
  Ministry of Justice Design System: banners, badges, filters, and
  other MOJ-specific patterns.
