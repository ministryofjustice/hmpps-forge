---
title: Testing
section: building-journeys
path: building-journeys/testing
teaches: [ForgeTestHarness, ForgeTestClient, createTestPackage, TestRenderResult, TestRedirectResult, TestResult, getBlocksByVariant, getValidationErrorsByFieldCode]
prerequisites: [journey, step, block, field, onSubmission, onAccess, effects, registerPackage, createForgePackage]
---

<p class="govuk-caption-xl">Testing</p>

# Testing journeys

Forge ships a test adapter that lets you exercise your journeys in
unit tests without standing up a server, configuring templates, or
rendering HTML. You send requests, get back structured results, and
assert on the data.

{{slot:toc}}

---

## Setting up

Import `ForgeTestHarness` from the testing module, register your
components and packages, and call `createClient()`.

```typescript
import { ForgeTestHarness, createTestPackage } from '@ministryofjustice/hmpps-forge/core/testing'
import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'

const client = new ForgeTestHarness()
  .registerGlobalComponents(govukComponents)
  .registerPackage({ journey: myJourney, functions: myEffects }, deps)
  .createClient()
```

`ForgeTestHarness` wires up the test adapter and a silent logger
internally. You register components and packages the same way you
would with `Forge`, then `createClient()` gives you a
`ForgeTestClient` you can send requests through.

---

## Sending requests

The client has two methods: `get()` and `post()`. Both take a path
and an optional options object where you provide session state,
request body, cookies, headers, and query parameters.

```typescript
const result = await client.get('/my-journey/step-one', {
  session: { user: 'test' },
})

const result = await client.post('/my-journey/step-one', {
  session: {},
  body: { firstName: 'Sam' },
})
```

Each request is independent. Session state, cookies, and headers are
passed explicitly per request  - the client does not carry state
between calls. To simulate a multi-step flow, pass the same session
object to each request and the effects will mutate it as they run.

---

## Reading results

Every request returns a `TestResult`, which is either a render or a
redirect.

### Render results

When the engine renders a step, the result contains the full render
context: answers, data, blocks, validation errors, and step metadata.

```typescript
const result = await client.get('/my-journey/step-one', { session: {} })

if (result.type === 'render') {
  // Answers loaded by effects
  expect(result.context.answers.firstName).toMatchObject({ current: 'Sam' })

  // Validation state
  expect(result.context.showValidationFailures).toBe(false)

  // Step metadata
  expect(result.context.step.title).toBe('What is your name?')
}
```

### Redirect results

When the engine redirects (from a submission hook, access guard, or
reachability check), the result contains the target URL.

```typescript
const result = await client.post('/my-journey/step-one', {
  session: {},
  body: { firstName: 'Sam' },
})

if (result.type === 'redirect') {
  expect(result.url).toContain('step-two')
}
```

Both result types also include `headers` and `cookies` maps if you
need to assert on response metadata.

---

## Inspecting blocks

Render results include a `getBlocksByVariant()` helper that returns
the evaluated blocks matching a given component variant. Each block
contains the fully resolved properties that would be passed to the
component at render time.

```typescript
const result = await client.get('/my-journey/step-one', { session: {} })

if (result.type === 'render') {
  const radios = result.getBlocksByVariant('govuk-radios')
  expect(radios).toHaveLength(1)
  expect(radios[0].properties.items).toHaveLength(3)
}
```

---

## Inspecting validation errors

Render results include a `getValidationErrorsByFieldCode()` helper
that returns the validation errors for a specific field. Each error
contains the message and any details attached to the validation rule.

```typescript
const result = await client.post('/my-journey/step-one', {
  session: {},
  body: {},
})

if (result.type === 'render') {
  const errors = result.getValidationErrorsByFieldCode('firstName')
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toBe('Enter your first name')
}
```

You can also check all field validation errors at once via
`result.context.fieldValidationErrors`, or use
`result.context.showValidationFailures` to check whether validation
is active.

---

## Substituting services in tests

When your journey uses effects that call external services, inject
mock dependencies through the `deps` argument to `registerPackage`.
Effects receive their services through `deps`, so stubbing a
dependency controls what an effect does without replacing the effect
itself.

```typescript
import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'

const mockApi = { saveRecord: vi.fn() }

const client = new ForgeTestHarness()
  .registerGlobalComponents(govukComponents)
  .registerPackage({ journey: myJourney, functions: myEffects }, { api: mockApi })
  .createClient()

await client.post('/my-journey/step-one', {
  session: {},
  body: { firstName: 'Sam' },
})

expect(mockApi.saveRecord).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Sam' }))
```

This keeps the effect's real logic under test while the service it
calls is a spy you can assert on. It is useful when some effects only
touch the session (and can run against their real dependencies) while
others call APIs or databases that you want to stub out.

### `createTestPackage` and the deprecated map form

`createTestPackage` replaces named function implementations with
spies or stubs, but its `overrides` apply only to the deprecated
implementations-map form of `functions`. A package whose `functions`
is a registry (or an array of registries) is returned unchanged, so
reach for dependency injection above instead.

```typescript
import { createTestPackage } from '@ministryofjustice/hmpps-forge/core/testing'

const mockSaveRecord = vi.fn()

// Only takes effect when `functions` is an implementations map
const testPkg = createTestPackage(
  { journey: myJourney, functions: myEffectImplementations },
  { overrides: { SaveRecord: mockSaveRecord } },
)
```

---

## Testing patterns

### Branching

Post different answer values and assert on the redirect URL to verify
each branch lands on the correct step.

```typescript
const result = await client.post('/booking/visit-type', {
  session: {},
  body: { visitType: 'in-person' },
})

expect(result.type).toBe('redirect')
if (result.type === 'redirect') {
  expect(result.url).toContain('location')
}
```

### Validation

Post without required fields and check that the result is a render
with validation errors.

```typescript
const result = await client.post('/booking/visit-type', {
  session: {},
  body: {},
})

if (result.type === 'render') {
  expect(result.context.showValidationFailures).toBe(true)

  const errors = result.getValidationErrorsByFieldCode('visitType')
  expect(errors).toHaveLength(1)
}
```

### Session effects

Pass a mutable session object and check its state after the request
to verify that effects wrote the expected data.

```typescript
const session: Record<string, unknown> = {}

await client.post('/booking/visit-type', {
  session,
  body: { visitType: 'phone' },
})

const drafts = session.patternDrafts as Record<string, Record<string, unknown>>
expect(drafts?.booking?.visitType).toBe('phone')
```

### Access guards

Pre-populate session state and verify that accessing a step either
renders or redirects based on the guard conditions.

```typescript
// Without the required session state  - redirected away
const blocked = await client.get('/booking/confirmation', { session: {} })
expect(blocked.type).toBe('redirect')

// With the required session state  - renders
const allowed = await client.get('/booking/confirmation', {
  session: { patternSubmitted: { booking: true } },
})
expect(allowed.type).toBe('render')
```
