---
title: Forge Core
section: packages
path: packages/forge-core/overview
teaches: [forge-core, core-authoring, core-components, core-framework]
prerequisites: [packages]
---

<p class="govuk-caption-xl">Packages</p>

# Forge Core
The core package contains everything needed to define, compile, and
run journeys. It has no framework or design system dependencies,
making it the foundation that all other packages build on.

{{slot:toc}}

---

## Entry points

Forge Core exposes five entry points, each targeting a different
concern:

### `@ministryofjustice/hmpps-forge/core`

The full engine: authoring, compilation, and runtime. This is what
you use when creating a `Forge` instance and registering packages.

```typescript
import { Forge } from '@ministryofjustice/hmpps-forge/core'
```

### `@ministryofjustice/hmpps-forge/core/authoring`

Builders, definition types, conditions, transformers, generators,
and all the functions you use to define journeys.

```typescript
import {
  journey, step, access, submit, redirect, validation,
  Answer, Self, Data, Session, Params, Query, Post,
  Condition, Transformer, Generator,
  Literal, Format,
  when, and, or, not,
  createForgePackage,
} from '@ministryofjustice/hmpps-forge/core/authoring'
```

### `@ministryofjustice/hmpps-forge/core/components`

The built-in component set that ships with core: `HtmlBlock`,
`CollectionBlock`, and `TemplateWrapper`. These are available in
every journey without registering a component library.

```typescript
import { HtmlBlock, CollectionBlock, TemplateWrapper } from '@ministryofjustice/hmpps-forge/core/components'
```

### `@ministryofjustice/hmpps-forge/core/framework`

Framework adapter interfaces. Used when building a custom adapter
for a framework other than Express and Nunjucks.

```typescript
import type { ForgeRenderer, ForgeTopology, RequestSnapshot } from '@ministryofjustice/hmpps-forge/core/framework'
```

### `@ministryofjustice/hmpps-forge/core/testing`

The in-memory test harness for exercising journeys without a real
web framework: `ForgeTestHarness` and `ForgeTestClient`.

```typescript
import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
```
