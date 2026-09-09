---
title: createForgePackage()
slug: create-forge-package
section: reference
path: reference/create-forge-package
nav: Authoring API
order: 1
description: Bundles a journey with its functions and components into a package that Forge can register
teaches: [createForgePackage, package, registration, functions, components, enabled, dependencies]
prerequisites: [journey]
related:
  concept: packaging-journeys-into-an-app
  reference: journey, condition, effect, forge-test-harness
---

# `createForgePackage()`

`createForgePackage()` prepares a journey for registration. You give it a journey
definition and any package-scoped functions or components. It finalises the journey
tree, collects function entries and components embedded in it, and returns a branded
package that `Forge.registerPackage()` or
[`ForgeTestHarness.registerPackage()`](./forge-test-harness) will accept.

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'

export default createForgePackage<AppDeps>({
  journey: applicationJourney,
})
```

Package creation and package registration are two separate phases. You create the
package at definition time, usually as a module's default export. You register it
later at application startup, when you can supply the real dependencies your
functions need. This separation lets you create a package once and register it in
different contexts (your application and your tests) with different dependencies
each time.

---

## Reference

### `createForgePackage(pkg)`

Call `createForgePackage()` to turn a journey definition into a registerable
package. Forge walks the journey tree to:

1. Finalise any builder objects into their concrete definitions.
2. Collect function entries embedded in the journey into an internal registry, so
   you don't need to list them in `functions`. These are the entries that
   [`condition()`](./condition), [`transformer()`](./transformer),
   [`generator()`](./generator), and [`effect()`](./effect) stamp onto the tree when
   you use them.
3. Collect components embedded in blocks, so you don't need to list those in
   `functions` either.
4. Brand the result with `forgePackage: true`, which `registerPackage()` checks
   before it will compile the journey.

[See more examples below.](#usage)

```typescript
function createForgePackage<TDeps = Record<string, never>>(
  pkg: ForgePackage<TDeps>,
): RegisteredForgePackage<TDeps>
```

#### Parameters

:::param
---
name: pkg
type: ForgePackage<TDeps>
required: true
---
An object containing the journey and any package-scoped functions and components.
Its properties are listed below.
:::

#### Package properties

:::param
---
name: journey
type: JourneyDefinition | string
required: true
---
The root [journey](./journey) for this package. A package contains exactly one root
journey; use `children` on that journey to nest additional route scopes beneath it.

When you pass a JSON string, `createForgePackage()` parses it into a journey
definition. This is useful when the journey comes from a file or an API rather than
from TypeScript code.

At registration time, Forge compiles the journey into routes. If the resulting
routes conflict with another registered package, Forge reports
`Duplicate route path` and does not register the package.
:::

:::param
---
name: functions
type: "BaseFunctionRegistry<TDeps> | (BaseFunctionRegistry<TDeps> | FunctionEntry<TDeps>)[]"
required: false
---
Function registries or individual entries to make available to this package's
journey, including components and step renderers. They are scoped to this package;
other packages cannot see them. Global registration is not available.

Registry classes are deprecated. Standalone function entries register automatically when
used in the journey, including entries whose factories need application dependencies.

You need `functions` in two situations:

- Your functions live in a registry. List it here so its metadata is available at
  registration. Its `build(deps)` runs during context preparation for each request.
- Your journey is a JSON string that references functions by name. List the
  entries here so Forge can find them by name during compilation. Listed entries
  must be named; an anonymous entry throws an error.

You do **not** need to list function entries that you use directly in the journey
tree. When you write `Self().match(IsValidMembershipNumber())` or
`effects: [LoadCaseData()]` inside a journey, `createForgePackage()` discovers
those entries and registers them for you.

A registry with no dependencies can appear on any package regardless of the
package's `TDeps`.
:::

:::param
---
name: enabled
type: boolean
required: false
---
Whether `registerPackage()` should register this package. Defaults to `true`.

When set to `false`, `registerPackage()` skips the package silently. No routes
are registered, no compilation runs, and nothing is logged. The brand check still
runs first, so even a disabled package must come from `createForgePackage()`.

Use this to control journey availability through configuration or feature flags
without removing the `registerPackage()` call.

[See disabling a package below.](#disable-a-package)
:::

#### Type parameter

:::param
---
name: TDeps
type: "Record<string, never>"
required: false
---
The dependency type for the package's functions and components. It defaults to an empty
record (no dependencies). Set it to match the dependency object you will pass to
`registerPackage()`:

```typescript
createForgePackage<{ bookingService: BookingService }>({ ... })
```

TypeScript then requires `registerPackage()` to receive an object with a
`bookingService` property.
:::

#### Returns

A `RegisteredForgePackage<TDeps>`: a branded, finalised package. Pass it to
`Forge.registerPackage()` or `ForgeTestHarness.registerPackage()` to compile the
journey and mount its routes.

#### Caveats

- `createForgePackage()` usually runs at module load time. When you write
  `export default createForgePackage(...)`, the call happens during import. Errors
  from this call (duplicate listed function names, anonymous listed entries,
  circular configuration, invalid JSON) throw during import, not during
  `registerPackage()`.

- Function factory errors surface during request context preparation, when the
  request registry binds its dependencies. Registration checks unbound metadata
  and compiles the journey without invoking factories.

- Embedded function entries that share a name are renamed automatically (for
  example, `condition`, `condition@2`). Listed entries are never renamed, because
  listing promises that exact name to external references. Two different listed
  entries with the same name throw a duplicate error.

- Components and step renderers follow the same entry naming rules as functions.
  Repeated references to one entry deduplicate. Different embedded entries sharing
  a name are renamed; explicitly listed names must be unique.

---

## Usage

### Create a package with no dependencies

The simplest package contains only a journey. Functions and components embedded in
the journey tree register themselves:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { bookingJourney } from './journey'

export default createForgePackage({
  journey: bookingJourney,
})
```

Register it with Forge. No dependency argument is needed:

```typescript
const forge = new Forge({ logger })
  .registerPackage(bookingPackage)
```

### Supply application dependencies

Functions used in the journey are collected automatically, including those whose
factories need application services. Declare the package's dependency type:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { bookingJourney } from './journey'
import type { BookingDeps } from './effects'

// Create the package
export default createForgePackage<BookingDeps>({
  journey: bookingJourney,
})
```

Pass those dependencies when registering the package:

```typescript
// Register it with application services
const forge = new Forge({ logger })
  .registerPackage(bookingPackage, {
    bookingService: services.bookingService,
  })
```

Each request combines package, adapter, and request dependencies before calling the
function factories.

### Register entries for a JSON journey

A JSON journey references functions by name and components by variant. It carries no
embedded entries, so populate the package's registry through `functions`:

```typescript
import { builtInFunctions, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { builtInComponents } from '@ministryofjustice/hmpps-forge/core/components'
import { LoadBooking } from './effects'
import { BookingSummary } from './components'
import type { BookingDeps } from './effects'

// Supply the entries referenced by the JSON definition
const bookingPackage = createForgePackage<BookingDeps>({
  journey: bookingJourneyJson,
  functions: [...builtInFunctions, ...builtInComponents, LoadBooking, BookingSummary],
})
```

`LoadBooking` and `BookingSummary` must have names matching the JSON references.
Add entries from component libraries when the JSON uses their variants. These entries
are available only to this package.

Explicit registration also applies to TypeScript definitions that reference names
without embedding entries. Calling functions and components in the journey collects
their entries automatically.

### Include an existing registry

If a journey uses functions from an existing registry class, pass that registry in
`functions` so its entries are available:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { bookingJourney } from './journey'
import { bookingEffectRegistry } from './effects'
import type { BookingDeps } from './effects'

export default createForgePackage<BookingDeps>({
  journey: bookingJourney,
  functions: [bookingEffectRegistry],
})
```

Registry classes are deprecated. New functions defined with `effect()`, `condition()`,
`transformer()`, or `generator()` are collected when used in the journey.

### Disable a package

Set `enabled` to `false` to skip registration without removing the
`registerPackage()` call:

```typescript
export default createForgePackage<AppDeps>({
  journey: applicationJourney,
  enabled: config.enableApplicationJourney,
})
```

When `enabled` is `false`, `registerPackage()` returns without compiling the
journey or registering routes.

### Create a package for testing

Create the package once at module scope. Register it with a fresh
[`ForgeTestHarness`](./forge-test-harness) per test, passing substituted
dependencies:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'

const basePackage = createForgePackage<BookingDeps>({
  journey: bookingJourney,
})

function createClient() {
  return new ForgeTestHarness()
    .registerPackage(basePackage, {
      bookingService: mockBookingService,
    })
    .createClient()
}
```

The package is created once and compiled fresh by each harness. This is the same
two-phase separation the application uses: create the package once, then register
it with different dependencies in different contexts.

---

## Troubleshooting

### Forge reports `Packages must be created with createForgePackage`

The object you passed to `registerPackage()` does not have the `forgePackage: true`
brand. Forge rejects unbranded objects even when their shape matches.

Wrap the definition with `createForgePackage()`:

```typescript
// Rejected: no brand
forge.registerPackage({ journey: myJourney })

// Accepted: branded by createForgePackage
forge.registerPackage(createForgePackage({ journey: myJourney }))
```

### An import throws with a duplicate function name

Two different function entries listed in `functions` share the same name. This
error throws during `createForgePackage()`, which usually runs at import time.

Give each listed entry a unique name. Entries embedded in the journey tree do not
need listing. `createForgePackage()` discovers them and renames them automatically
when their names overlap.

### An import throws with a duplicate component name

Two distinct component entries explicitly listed on the package claim the same name.
Listed names must be unique. Remove or rename the duplicate. Embedded components
register automatically and their names are disambiguated when needed.

### An import throws with a circular reference

A configuration object appears more than once in the journey tree. Forge requires
the definition to form a tree. No shared references between nodes are allowed.

Create separate instances of the repeated object. If you reuse a block or field
definition, extract it into a function that returns a new instance on each call.

### A request fails with a function build error

A function entry's factory threw during request context preparation. The error message
identifies the function that failed to bind.

Check the factory function for the named entry. The merged package, adapter, and
request dependencies must have the shape the factory expects. Duplicate keys across
these sources also fail context preparation.
