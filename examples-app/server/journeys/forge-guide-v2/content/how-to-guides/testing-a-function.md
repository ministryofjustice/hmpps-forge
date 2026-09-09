---
title: Testing a function
slug: testing-a-function
section: how-to-guides
path: how-to-guides/testing-a-function
nav: Extending Forge/Functions
order: 5
description: Unit-test registered conditions, transformers, generators, and effects with the function registry test harness
teaches: [FunctionRegistryTestHarness, createTestEffectContext, function-testing, dependency-substitution]
prerequisites: [condition, transformer, generator, effect]
---

# Testing a function

Behind every journey, there's a handful of little functions doing the real work. A condition decides whether a booking reference is valid. A transformer reshapes answers into a trip. An effect saves it. Our definitions decide when they run - but the logic inside them is ours, and it deserves its own tests.

We could test that logic by sending a request through the whole journey. That works - but if we want to check every value a condition accepts, or every shape a transformer might receive, going through the journey each time is a very roundabout way to test just one function.

That's where the `FunctionRegistryTestHarness` comes in. We give it the function entries our application uses, hand the function the value or context it would receive in a journey, and inspect the result - no journey, no request, just the function and its inputs!

In this how-to, we'll test a few functions from a small example booking journey. Let's begin by looking at the structure of a test.

---

## Start with one function and one result

Here is the whole test:

```typescript [[1, 5, "new FunctionRegistryTestHarness"], [2, 15, "IsLongEnough(minimumMinutes)"], [3, 16, "withInput(90)"], [4, 19, "expect(result).toBe(true)"]]
import { FunctionRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { describe, expect, it } from 'vitest'
import { IsLongEnough } from './bookingFunctions'

const harness = new FunctionRegistryTestHarness(IsLongEnough)

describe('IsLongEnough', () => {
  describe('IsLongEnough()', () => {
    it('should return true when the visit meets the minimum length', () => {
      // Arrange
      const minimumMinutes = 60

      // Act
      const result = harness
        .evaluate(IsLongEnough(minimumMinutes))
        .withInput(90)

      // Assert
      expect(result).toBe(true)
    })
  })
})
```

The <s1>harness</s1> receives the function entry.

The <s2>function handle</s2> chooses the function and supplies the minimum length authored in the definition.

In this example, the <s3>input</s3> is the value that would be piped into the condition at runtime. Here, that value is the visit length, and the <s4>result</s4> shows whether it meets the minimum.

That is the basic shape of a function test: build the harness, evaluate a registered function with the values it needs, and inspect what it produces. Let's look more closely at each part.

## Build the harness with the function entries

The harness starts with the same function entries as your application:

```typescript [[1, 4, "new FunctionRegistryTestHarness"], [8, 4, "IsLongEnough"]]
import { FunctionRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { IsLongEnough } from './bookingFunctions'

const harness = new FunctionRegistryTestHarness(IsLongEnough)
```

Using the <s8>function entry</s8> keeps the test connected to the function your application ships. Pass an array of entries to test several functions.

If those functions use application services, pass mocked versions as the second argument:

```typescript [[1, 5, "new FunctionRegistryTestHarness"], [8, 5, "SaveBooking"], [7, 5, "{ bookingStore }"]]
const bookingStore = {
  save: vi.fn().mockResolvedValue(undefined),
}

const harness = new FunctionRegistryTestHarness(SaveBooking, { bookingStore })
```

The <s7>mocked dependency</s7> lets a test control what happens outside the function. It can decide what the store returns, make it reject, or record what the function tried to save. The function itself remains the one registered by your application.

The harness stops at the function boundary. If you want to test a complete journey, [read our how-to guide on testing a journey](testing-a-journey).

## Testing condition functions

Conditions answer yes-or-no questions - which makes them relatively easy to test!
Try each <s4>result</s4> the condition can produce in a separate test.

```typescript [[2, 7, "IsLongEnough(minimumMinutes)"], [3, 8, "withInput(90)"], [4, 11, "expect(result).toBe(true)"], [2, 20, "IsLongEnough(minimumMinutes)"], [3, 21, "withInput(30)"], [4, 24, "expect(result).toBe(false)"]]
it('should return true when the visit meets the minimum length', () => {
  // Arrange
  const minimumMinutes = 60

  // Act
  const result = harness
    .evaluate(IsLongEnough(minimumMinutes))
    .withInput(90)

  // Assert
  expect(result).toBe(true)
})

it('should return false when the visit is too short', () => {
  // Arrange
  const minimumMinutes = 60

  // Act
  const result = harness
    .evaluate(IsLongEnough(minimumMinutes))
    .withInput(30)

  // Assert
  expect(result).toBe(false)
})
```

The <s2>handle</s2> chooses the condition from the registry, and the <s3>input</s3> is the value to test against the condition.  For <s2>`IsLongEnough()`</s2>, that means checking a visit that meets the minimum and one that does not:

## Testing transformer functions

Transformers also receive a value from the definition, so they use the same `withInput()` shape as conditions. This transformer formats a booking reference:

```typescript [[2, 7, "FormatReference()"], [3, 8, "withInput('ab 1234')"], [4, 11, "expect(result).toBe('AB-1234')"]]
import { FormatReference } from './bookingFunctions'

const harness = new FunctionRegistryTestHarness(FormatReference)

// Act
const result = harness
  .evaluate(FormatReference())
  .withInput('ab 1234')

// Assert
expect(result).toBe('AB-1234')
```

The <s2>handle</s2> chooses the transformer and the <s3>input</s3> is the value to transform. Your assertion checks the <s4>transformed value</s4> directly.

## Testing generator functions

A generator does not receive an input value. Its authored arguments are all it needs, so `evaluate()` returns its result immediately:

```typescript [[2, 6, "BuildReference('visit', 42)"], [4, 9, "expect(result).toBe('VISIT-42')"]]
import { BuildReference } from './bookingFunctions'

const harness = new FunctionRegistryTestHarness(BuildReference)

// Act
const result = harness.evaluate(BuildReference('visit', 42))

// Assert
expect(result).toBe('VISIT-42')
```

There is no `withInput()` call here. The prefix and number are already part of the <s2>function handle</s2>, so the <s4>generated reference</s4> is ready to assert.

## Testing effect functions

An effect is different because it works with the current request context. For example, a booking effect might read the current answers, save them, and record that the booking has been saved.

Use `createTestEffectContext()` to give the effect the state it needs:

```typescript [[7, 9, "vi.fn().mockResolvedValue(undefined)"], [1, 12, "new FunctionRegistryTestHarness"], [8, 12, "SaveBooking"], [7, 12, "{ bookingStore }"], [5, 18, "createTestEffectContext"], [2, 27, "SaveBooking()"], [3, 28, "withContext(context)"], [7, 31, "bookingStore.save"], [4, 36, "expect(context.getAnswer('bookingStatus')).toBe('saved')"]]
import {
  FunctionRegistryTestHarness,
  createTestEffectContext,
} from '@ministryofjustice/hmpps-forge/core/testing'
import { describe, expect, it, vi } from 'vitest'
import { SaveBooking } from './bookingFunctions'

const bookingStore = {
  save: vi.fn().mockResolvedValue(undefined),
}

const harness = new FunctionRegistryTestHarness(SaveBooking, { bookingStore })

describe('SaveBooking', () => {
  describe('SaveBooking()', () => {
    it('should save the booking and update its status', async () => {
      // Arrange
      const context = createTestEffectContext({
        answers: { visitType: 'video' },
        data: { bookingId: 'booking-123' },
        session: { userId: 'user-7' },
        hookType: 'submit',
      })

      // Act
      await harness
        .evaluate(SaveBooking())
        .withContext(context)

      // Assert
      expect(bookingStore.save).toHaveBeenCalledWith({
        id: 'booking-123',
        createdBy: 'user-7',
        visitType: 'video',
      })
      expect(context.getAnswer('bookingStatus')).toBe('saved')
    })
  })
})
```

The <s5>test context</s5> starts with the answers, data, and session the effect expects to find. You only need to seed the values that matter to this test.

Passing that context through <s3>`withContext()`</s3> runs the <s2>effect</s2> against it. Afterwards, the <s7>mock</s7> shows what the effect tried to save, and the <s4>context assertion</s4> shows what the effect changed.

`createTestEffectContext()` gives you the same context methods your effect normally uses. You can inspect answers, data, and session after the effect runs. If the effect sets a response header or cookie, use `getResponseHeaders()` or `getResponseCookies()` to read it back.

Setting `hookType: 'submit'` also makes answer changes record `submit` as their source. Leave it out when the distinction does not matter to the test.

## Test asynchronous functions

If a registered function is asynchronous, await it just as you would any other asynchronous work. The effect above waits for `bookingStore.save()`, so the test awaits `withContext()` before checking the store or context.

You can also test a <s7>rejected dependency</s7> directly:

```typescript [[7, 3, "mockRejectedValue(error)"], [5, 4, "createTestEffectContext"], [2, 12, "SaveBooking()"], [3, 13, "withContext(context)"], [4, 16, "await expect(result).rejects.toBe(error)"]]
// Arrange
const error = new Error('Could not save booking')
bookingStore.save.mockRejectedValue(error)
const context = createTestEffectContext({
  data: { bookingId: 'booking-123' },
  answers: { visitType: 'video' },
  session: { userId: 'user-7' },
})

// Act
const result = harness
  .evaluate(SaveBooking())
  .withContext(context)

// Assert
await expect(result).rejects.toBe(error)
```

This is a direct function test, so a thrown error or <s4>rejected promise</s4> reaches the test directly. When you test the same effect as part of a journey, `ForgeTestHarness` catches it at the request boundary and produces an error outcome instead.

## Test invalid and missing inputs

The harness is useful for more than happy paths. It honours the schemas registered with your function, so you can check what happens when a value has the wrong shape:

```typescript [[2, 6, "FormatReference()"], [3, 7, "withInput(123)"], [4, 10, "expect(act).toThrow(TypeError)"]]
// Arrange
const harness = new FunctionRegistryTestHarness(FormatReference)

// Act
const act = () => harness
  .evaluate(FormatReference())
  .withInput(123)

// Assert
expect(act).toThrow(TypeError)
```

Here, `FormatReference` was registered with a string input schema. The <s3>invalid input</s3> produces a <s4>`TypeError`</s4> before it can be treated as a booking reference.

Missing values have a useful default too. A condition given `undefined` returns `false`, while a transformer given `undefined` returns `undefined`. In both cases the function itself is skipped. You can test that behaviour without adding special handling to the function:

```typescript [[2, 6, "IsLongEnough(60)"], [3, 7, "withInput(undefined)"], [4, 10, "expect(result).toBe(false)"]]
// Arrange
const harness = new FunctionRegistryTestHarness(IsLongEnough)

// Act
const result = harness
  .evaluate(IsLongEnough(60))
  .withInput(undefined)

// Assert
expect(result).toBe(false)
```

Or for a transformer:

```typescript [[2, 6, "FormatReference()"], [3, 7, "withInput(undefined)"], [4, 10, "expect(result).toBeUndefined()"]]
// Arrange
const harness = new FunctionRegistryTestHarness(FormatReference)

// Act
const result = harness
  .evaluate(FormatReference())
  .withInput(undefined)

// Assert
expect(result).toBeUndefined()
```

The harness also checks configured arguments and output schemas. You do not need separate testing code for those checks: use the real handle, pass the value you want to exercise, and assert the result or error.

## Recap

You've now tested conditions, transformers, generators, and effects without building a journey around them.

Let's recap the key points.

- Build the harness with function entries and any substituted dependencies they need.
- Evaluate the same function handle that your definition uses.
- Supply `withInput()` for conditions and transformers, no input for generators, and `withContext()` for effects.
- Use `createTestEffectContext()` to arrange and inspect the state an effect works with.
- Pass concrete values to function tests; use `ForgeTestHarness` when the behaviour depends on a journey resolving references or handling a request.
