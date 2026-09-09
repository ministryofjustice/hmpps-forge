---
title: Testing a journey
slug: testing-a-journey
section: how-to-guides
path: how-to-guides/testing-a-journey
nav: Testing your content
order: 2
description: Exercise journeys in unit tests with the Forge test harness
teaches: [ForgeTestHarness, ForgeTestClient, TestResult, dependency-substitution]
prerequisites: [journey, step, block, field, submit, access, effect]
---

# Testing a journey
When we build a journey, we're making a lot of tiny little promises. This page redirects when there's no booking. That field rejects an empty answer. The confirmation page only appears once a booking exists. Testing a journey means checking those promises hold.

We could start the application and click through each path ourselves. That's a fine way to see the whole service working - but it's a slow way to check every branch, validation rule, and access decision, and slower still to check them again after every change.

That's what the `ForgeTestHarness` is for. We give it the same package and dependencies as our application, send it a request, and inspect the outcome - no server, no browser, no clicking through!

In this guide, we'll test a small booking journey. It collects and saves a visit type, lets the person check their answers, and only shows its confirmation page once a booking exists. Let's dive in!

---

## Start with one request and one outcome

Let's start with the visit-type step. It asks how someone would like to meet, and an in-person visit should take them to the location step. Here is the whole test:

```typescript [[1, 11, "new ForgeTestHarness()"], [2, 28, "client.post('/booking/visit-type'"], [3, 34, "expectRedirectOutcome(result)"], [4, 35, "result.url"]]
import { ForgeTestHarness, expectRedirectOutcome } from '@ministryofjustice/hmpps-forge/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import bookingPackage from './bookingPackage'

const formDataStore = {
  get: vi.fn(),
  set: vi.fn(),
}

function createClient() {
  return new ForgeTestHarness()

    .registerPackage(bookingPackage, { formDataStore })
    .createClient()
}

describe('bookingJourney', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('visit-type', () => {
    it('should redirect to location when the visit is in person', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.post('/booking/visit-type', {
        session: {},
        body: { visitType: 'in-person' },
      })

      // Assert
      expectRedirectOutcome(result)
      expect(result.url).toContain('location')
    })
  })
})
```

There is quite a bit of setup in that example, but the test itself has a simple shape. Three parts are doing the work.

The <s1>harness</s1> receives the package and dependencies needed to evaluate the journey.

The <s2>test request</s2> specifies a path and the data that arrived with it.

The <s3>outcome assertion</s3> checks that the result was a redirect and gives the test access to the <s4>redirect URL</s4> through `result.url`.

That is the basic shape of a journey test: build a client, send a request, and inspect the outcome. Let's explore how each part works!

## Build the client with the real package

The package already collects the functions and components used in its journey. Register it with the dependencies our test supplies:

```typescript [[8, 4, "bookingPackage"], [7, 4, "{ formDataStore }"]]
// Arrange
const client = new ForgeTestHarness()

  .registerPackage(bookingPackage, { formDataStore })
  .createClient()
```

Use the <s8>real package</s8> here rather than rebuilding a smaller journey for the test. That way you're exercising the same journey definition your application uses, not a simplified copy.

The <s7>package's dependencies</s7> are passed as the second argument to `registerPackage()`, just as they are when registering the package on `Forge` directly.

Under the hood, the harness creates a real `Forge` instance. That means your tests run the real journey definition, hooks, effects, validation, reachability, and navigation without needing to start a web server or render HTML.

The harness stops at Forge's boundary. It doesn't check the final HTML, client-side behaviour, or how your application integrates Forge with its web framework. Those are better covered by browser and integration tests.

Most test suites put this setup into a `createClient()` function like this one. That keeps each test focused on the request it's making and the behaviour it expects. If several tests share the same mocked dependencies, reset them in `beforeEach()` so one test's calls don't affect the next.

## Arrange the request context explicitly

Each <s2>test request</s2> uses `get()` or `post()`. Both take a path and, when needed, an options object containing the values that would normally arrive from the web framework:

```typescript [[2, 2, "client.get('/booking/check-answers'"]]
// Act
const result = await client.get('/booking/check-answers', {
  session: { userId: 'test-user' },
  query: { returnTo: 'task-list' },
  headers: { 'x-test-role': 'caseworker' },
})
```

The available request values are `session`, `body`, `headers`, `cookies`, `query`, `params`, and `state`. A `requestDependencies` callback can supply dependencies for that request.

Each request starts fresh. If you're testing a page halfway through a journey, give the request the state it would have by then. Pass session data in the options, or control the mocked dependency an access hook loads from.

You don't need to submit every page that came before it. The access hooks still run, the answers are still prepared, and reachability is still enforced as part of the test. Let's look at how to control what those hooks load.

## Control behaviour through mocked dependencies

<s7>Mocked dependencies</s7> let a test control what the package's registered functions read and inspect how those functions write. For example, the store can return a saved visit type when the booking journey loads its answers:

```typescript [[7, 2, "mockResolvedValue({ visitType: 'video' })"]]
// Arrange
formDataStore.get.mockResolvedValue({ visitType: 'video' })
```

When the test sends its request, the journey's access hook and loading function still run. The only thing you've replaced is where the data comes from.

That means you can control what the journey loads without skipping any of its behaviour. Once the request has finished, the result shows what the journey received and the mock records how the journey interacted with the dependency.

The same approach lets you make a dependency reject, or inspect the values a saving function passed to it. That
gives each test the simple shape we saw earlier: arrange the dependencies, send one request, then inspect the
outcome and the dependency calls that matter.

## Test what happens when a page renders

When someone visits a page and nothing redirects or ends the request early, the result is a render outcome. Use `expectRenderOutcome()` to assert that the step rendered before inspecting the page it assembled:

```typescript [[3, 5, "expectRenderOutcome(result)"], [4, 6, "getBlocksByVariant('govukRadioInput')"], [4, 9, "properties.items"]]
// Act
const result = await client.get('/booking/visit-type', { session: {} })

// Assert
expectRenderOutcome(result)
const radioInputs = result.getBlocksByVariant('govukRadioInput')

expect(radioInputs).toHaveLength(1)
expect(radioInputs[0].properties.items).toHaveLength(3)
```

The <s3>outcome assertion</s3> checks that a step rendered and makes the render-specific result available. `getBlocksByVariant()` then finds the <s4>radio input in that result</s4>. From there, the test can inspect the component properties it cares about - in this case, the three radio items.

The full render context is available through `result.context`. It contains the prepared answers, loaded data, resolved blocks, validation state, and step metadata. If the client has a renderer configured, its assembled output is available through `result.output`.

This is usually the useful level for checking authored content. If a label depends on loaded data, check the resolved label. If `visibleWhen` hides a block, check that its resolved `properties.visibleWhen` is `false`. The block remains in the context, and rendering produces empty output for it. If an iterator creates one row per item, check the rows it produced. These assertions stop at the rendering boundary, so they do not need to parse HTML.

## Test what happens when a submission succeeds

A successful submission does more than choose the next page. In the booking journey, it saves the submitted answer before it redirects. The opening test already used `expectRedirectOutcome()` to check the destination. A more complete test checks both the redirect and the work that happened before it:

```typescript [[3, 8, "expectRedirectOutcome(result)"], [4, 9, "result.url"], [7, 10, "formDataStore.set"], [7, 12, "visitType: 'phone'"]]
// Act
const result = await client.post('/booking/visit-type', {
  session: {},
  body: { visitType: 'phone' },
})

// Assert
expectRedirectOutcome(result)
expect(result.url).toContain('phone-number')
expect(formDataStore.set).toHaveBeenCalledWith(
  'booking',
  expect.objectContaining({ visitType: 'phone' }),
)
```

The submitted answer passes validation, so the submission hook's `onValid` functions run and follow the redirect they produce. The <s3>redirect outcome</s3> confirms that the journey continued, while the <s4>chosen destination</s4> shows where it went. The store assertion checks the <s7>answer passed through the saving dependency</s7> before that redirect.

Together, these checks cover one successful submission from both sides: the outcome described by the journey, and the application work that happened along the way.

Every result also exposes response metadata through its `headers` and `cookies` maps. When a hook or effect changes them, inspect the value on the same result:

```typescript [[4, 2, "result.headers"]]
// Assert
expect(result.headers.get('x-booking-reference')).toBe('AB1234')
```

## Test what happens when a submission fails

A submission fails validation when its input does not satisfy the field's rules. Send the visit-type request without an answer, and the submission should stay on the current step and show its validation message. This is another render outcome, so the test can use the helper you have already seen and focus on the validation details:

```typescript [[2, 4, "body: {}"], [3, 8, "expectRenderOutcome(result)"], [4, 9, "result.context.showValidationFailures"], [4, 11, "getValidationErrorsByFieldCode('visitType')"], [4, 14, "errors[0].message"]]
// Act
const result = await client.post('/booking/visit-type', {
  session: {},
  body: {},
})

// Assert
expectRenderOutcome(result)
expect(result.context.showValidationFailures).toBe(true)

const errors = result.getValidationErrorsByFieldCode('visitType')

expect(errors).toHaveLength(1)
expect(errors[0].message).toBe('Select how you would like to meet')
expect(formDataStore.set).not.toHaveBeenCalled()
```

The <s2>test request is submitted with an empty body</s2>, giving the validation rule no answer to work with. The <s3>render outcome</s3> confirms that the step stayed rendered.

The <s4>validation details</s4> show that failures are visible, identify the error attached to `visitType`, and expose the message authored on that field. Together, they show that the field and its rule are connected correctly. The saving function does not run because the submission never reaches its `onValid` behaviour.

A validation failure is not an error outcome. The submission was evaluated and its input was found to be invalid. Rendering the step again is the default result; if the hook has an `onInvalid` branch that redirects or returns an error, test that outcome instead.

## Test what happens when an error occurs

For the final case, keep the valid answer but make the <s7>saving dependency reject</s7>. When a request should end this way, use `expectErrorOutcome()` to assert the outcome before inspecting the original error through `result.error`.

This example uses `http-errors` so the error carries the status the application wants to return:

```typescript [[7, 5, "mockRejectedValue(error)"], [3, 14, "expectErrorOutcome(result)"], [4, 15, "result.error"]]
import createHttpError from 'http-errors'

// Arrange
const error = createHttpError(503, 'Could not save booking')
formDataStore.set.mockRejectedValue(error)

// Act
const result = await client.post('/booking/visit-type', {
  session: {},
  body: { visitType: 'phone' },
})

// Assert
expectErrorOutcome(result)
expect(result.error).toBe(error)
expect(result.error.status).toBe(503)
expect(result.error.message).toBe('Could not save booking')
```

The request reaches the same submission hook and passes the same validation as the successful case. This time the saving function's dependency rejects. The exception is caught at the request boundary and produces an <s3>error outcome</s3>, so the test resolves normally.

The <s4>original `Error` object</s4> is preserved rather than copied into a separate result. That is why the identity assertion passes, and why its status, stack, diagnostic information, and any other properties remain available to the test.

Errors deliberately authored with `throwError()` arrive through `result.error` in the same way. So do unexpected exceptions from registered functions. An ordinary `Error` may not have a status, and the harness leaves it that way.

## Recap

You've now tested the same journey through a normal render, a successful submission, a validation failure, and an error, all without putting a web framework around Forge.

Keep those as separate tests, with one starting condition and one expected outcome in each. When one fails, you can see which behaviour changed without tracing a complete journey.

Let's recap the key points.

- Build the test client with the same package and substituted dependencies as the application.
- Give each `get()` or `post()` request the context and dependency behaviour it needs.
- Assert whether the result is a render, redirect, or error before inspecting its specific details.
- Check both the outcome and any important interactions with substituted dependencies.
- Keep each journey test focused on one request and one expected behaviour; use end-to-end tests for complete paths.
