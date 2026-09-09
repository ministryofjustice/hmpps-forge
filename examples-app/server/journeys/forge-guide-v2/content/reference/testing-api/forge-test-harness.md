---
title: ForgeTestHarness
slug: forge-test-harness
section: reference
path: reference/forge-test-harness
nav: Testing API
order: 100
description: Builds a Forge test client from registered packages, components, functions, and dependencies
teaches: [ForgeTestHarness, registerPackage, createClient, instrumentation]
prerequisites: [create-forge-package]
related:
  concept: packaging-journeys-into-an-app, how-forge-runs-a-request
  reference: create-forge-package
  how-to: testing-a-journey
---

# `ForgeTestHarness`

`ForgeTestHarness` builds a test client around a real Forge instance, without starting a
web server.

```typescript
const client = new ForgeTestHarness()
  .registerPackage(bookingPackage, { formDataStore })
  .createClient()
```

---

## Reference

### `new ForgeTestHarness(options?)`

Create a harness, register everything the journey needs, then call `createClient()`.
The harness defaults to strict package registration and a silent logger. Each package
provides its own entries; TypeScript builders collect the built-ins they use.

[See a complete setup below.](#build-a-client-for-a-package)

```typescript
constructor(options?: ForgeTestHarnessOptions)
```

#### Parameters

:::param
---
name: options
type: ForgeTestHarnessOptions
required: false
---
Configuration for the Forge instance used by the test. When omitted, instrumentation is
disabled.
:::

#### Options properties

:::param
---
name: instrumentation
type: ForgeInstrumentationOptions
required: false
---
Instrumentation sinks and source-capture behaviour for compilation and request traces.
Use this when the trace itself is part of the behaviour under test. When omitted, the
harness does not emit trace events.

[See collecting request traces below.](#collect-request-traces)
:::

:::param
---
name: sinks
parent: instrumentation
type: readonly ForgeInstrumentationSink[]
required: false
---
Receivers for request and compilation trace events. A sink must implement
`onRequestTrace()` and can implement `onCompilationTrace()` and `shouldTrace()`.
:::

:::param
---
name: captureGeneratedSource
parent: instrumentation
type: boolean
required: false
---
When `true`, compilation traces include generated JavaScript source. Defaults to `false`.
The source is verbose, so enable it only for tests that need to inspect compilation
output.
:::

:::param
---
name: maxIteratorIterations
type: number
required: false
---
Maximum iterations across one request. Defaults to 10,000.
:::

:::param
---
name: strictRegistration
type: boolean
required: false
---
Whether invalid package registration throws. Defaults to `true`; when `false`, failures
are logged and the package is skipped.
:::

:::param
---
name: logger
type: Logger | Console
required: false
---
Logger used by the Forge instance. Defaults to a silent logger.
:::

:::param
---
name: basePath
type: string
required: false
---
Base path applied to mounted routes. Defaults to an empty string.
:::

### `registerPackage(pkg, deps?)`

Register and compile a Forge package. Components and functions declared by the package
are registered before its journey is compiled.

```typescript
registerPackage<TDeps>(
  pkg: ForgePackageRegistration<TDeps>,
  deps?: TDeps,
): this
```

#### Parameters

:::param
---
name: pkg
type: ForgePackageRegistration<TDeps>
required: true
---
The package containing the journey and any package-scoped components or functions. A
package with `enabled: false` is skipped. Invalid definitions, missing registrations,
and route conflicts throw during registration.

[See the package registration reference.](create-forge-package)
:::

:::param
---
name: deps
type: TDeps
required: false
---
Dependencies passed to the package's functions. Use the same dependency shape as the
application, substituting test doubles where the journey crosses an external boundary.
:::

#### Returns

The same harness, so more packages can be added before creating
the client.

### `createClient(renderer?, adapterDependencies?)`

Create a `ForgeTestClient` from the packages currently held by the harness.

```typescript
createClient(
  renderer?: ForgeRenderer<unknown>,
  adapterDependencies?: object,
): ForgeTestClient
```

#### Parameters

:::param
---
name: renderer
type: ForgeRenderer<unknown>
required: false
---
An optional renderer used when a request produces a render outcome. Without one, render
results still contain the fully resolved context and blocks, but `result.output` is
`undefined`.

[See creating a client with a renderer below.](#create-a-client-with-a-renderer)
:::

:::param
---
name: adapterDependencies
type: object
required: false
---
Stable dependencies shared by this client's requests, such as `nunjucksEnv` for Nunjucks
components. They merge with package and request dependencies; duplicate keys fail the request.
When omitted, no adapter dependencies are added.
:::

#### Returns

A `ForgeTestClient` with `get()` and `post()` methods for exercising the registered
routes. Each request produces a render, redirect, or error result.

---

## Usage

### Build a client for a package

Register the same package as the application, but replace its
external dependencies with <s1>test doubles</s1>:

```typescript [[1, 5, "formDataStore"], [1, 11, "formDataStore"]]
import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { vi } from 'vitest'
import bookingPackage from './bookingPackage'

const formDataStore = {
  get: vi.fn(),
  set: vi.fn(),
}

const client = new ForgeTestHarness()
  .registerPackage(bookingPackage, { formDataStore })
  .createClient()
```

The harness builds the client, compiles the real package, and runs the real request
lifecycle. Only the <s1>dependency crossing the application's boundary</s1> has been
substituted. This keeps the test in control of loaded data and saved values without
copying or bypassing the journey definition.

For request and result examples, see [Testing a journey](../how-to-guides/testing-a-journey).

### Supply dependencies for one request

Pass `requestDependencies` on a client request when factories need request-specific services:

```typescript
const result = await client.get('/booking/visit-type', {
  session: {},
  requestDependencies: () => ({ currentUser }),
})
```

The callback can return an object or a promise-like object. Its resolved properties merge
with package and adapter dependencies. Duplicate keys across these sources fail the request.

### Create a client with a renderer

Pass a renderer when the <s3>assembled rendering output</s3> is part of the test:

```typescript [[3, 3, "testRenderer"], [3, 8, "result.output"]]
const client = new ForgeTestHarness()
  .registerPackage(bookingPackage, { formDataStore })
  .createClient(testRenderer)

const result = await client.get('/booking/visit-type', { session: {} })

expectRenderOutcome(result)
expect(result.output).toContain('Choose a visit type')
```

Most journey tests do not need a renderer. They can inspect `result.context` and its
resolved blocks directly. Use framework or browser tests when the behaviour depends on
templates, HTML, or client-side code rather than Forge's rendering contract.

### Collect request traces

Pass an <s4>instrumentation sink</s4> to observe the phases Forge runs for a request:

```typescript [[4, 7, "onRequestTrace: event => events.push(event)"], [4, 15, "events.length"]]
import type { RequestTraceEvent } from '@ministryofjustice/hmpps-forge/core/testing'

const events: RequestTraceEvent[] = []

const client = new ForgeTestHarness({
  instrumentation: {
    sinks: [{ onRequestTrace: event => events.push(event) }],
  },
})
  .registerPackage(bookingPackage, { formDataStore })
  .createClient()

await client.get('/booking/visit-type', { session: {} })

expect(events.length).toBeGreaterThan(0)
```

The <s4>sink</s4> receives events from the instrumented Forge instance, so it can also
receive compilation events emitted while packages are registered. Add
`onCompilationTrace()` to the sink when the test needs those events.

---

## Troubleshooting

### Registration reports an unknown component or function

The package references an entry it does not provide. Use its builder in the journey,
or list the entry in the package's `functions` when the definition references names.
This also applies to built-ins in JSON journeys.

### A registered function receives missing dependencies

Pass package dependencies to `registerPackage()`, adapter dependencies to
`createClient()`, and request dependencies through the client request options.
Factories receive the merged object during each request's context preparation.

Keep the test dependency object the same shape as the production object. Replace its
values with test doubles rather than renaming or omitting properties.

### `result.output` is `undefined`

The client was created without a renderer. This is expected: Forge can still return the
resolved render context and blocks without assembling framework-specific output.

Inspect `result.context`, or pass a `ForgeRenderer` to `createClient()` when assembled
output is what the test needs to verify.

### The harness does not log a registration error

The harness deliberately uses a silent logger. Registration remains strict, so invalid
packages throw from `registerPackage()` instead of only being logged.

Let the exception fail the test, or assert on it directly when registration failure is
the behaviour under test.
