---
title: Testing a component
slug: testing-a-component
section: how-to-guides
path: how-to-guides/testing-a-component
nav: Extending Forge/Components
order: 3
description: Unit-test how a component turns evaluated block properties into rendered output
teaches: [component-testing, resolved-props, component-rendering, renderer-boundary]
prerequisites: [block, component]
related:
  concept: how-blocks-resolution-and-rendering-connect
  how-to: [testing-a-journey]
---

# Testing a component

Every rendered page is built from components. A tag shows a booking's status. A summary list lays out the answers. Each one takes the properties it's given and turns them into rendered output.

We could check that output by sending a request through a journey and searching the assembled page, but that would require hunting down the component's HTML.
Luckily for us, we can render a component with `FunctionRegistryTestHarness`: we build the evaluated properties ourselves, render them, and inspect the output - no request, no journey, no browser!

In this how-to, we'll test a `BookingStatusTag` component. It displays a booking status using a label and colour. Let's begin by rendering it in its simplest state.

---

## Start with one state and one output

Let's start with the confirmed state. A confirmed booking should render a green tag
labelled "Confirmed". Here is the whole test:

```typescript [[1, 11, "const block = BookingStatusTag({"], [2, 16, "harness.render(block)"], [3, 19, "expect(output).toContain('Confirmed')"], [3, 20, "expect(output).toContain('govuk-tag--green')"]]
import { FunctionRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { describe, expect, it } from 'vitest'
import { BookingStatusTag } from './bookingStatusTag'

const harness = new FunctionRegistryTestHarness(BookingStatusTag)

describe('BookingStatusTag', () => {
  describe('render()', () => {
    it('should render a green tag when the booking is confirmed', async () => {
      // Arrange
      const block = BookingStatusTag({
        status: 'confirmed',
      })

      // Act
      const output = await harness.render(block)

      // Assert
      expect(output).toContain('Confirmed')
      expect(output).toContain('govuk-tag--green')
    })
  })
})
```

That is the basic shape of a component test: build a block with concrete props, render it, and
check the output. Three parts are doing the work.

The <s1>block with concrete props</s1> is the state already prepared for the component.
By the time a component renders in a real request, every expression in its authored
properties has been resolved - `Data()` references, conditions, iterators, all of it.
Your test supplies those plain values, so it starts at exactly the point where
expression resolution ends and the component takes over.

The <s2>render call</s2> runs the same function called when the page is assembled.
The harness receives the component entry and any dependencies its factory needs.

The <s3>output assertions</s3> check the rendered result - here, that the tag carries
the confirmed label and the green colour class.

Let's use that shape to cover the component's other states.

## Test each state the component can display

Most component tests repeat the same three parts. Change the evaluated block, render
it, and check what changed. A pending booking renders a yellow tag, and authored text
should replace the default label:

```typescript [[1, 4, "text: 'Waiting for approval'"], [3, 11, "expect(output).toContain('Waiting for approval')"], [3, 12, "expect(output).toContain('govuk-tag--yellow')"]]
// Arrange
const block = BookingStatusTag({
  status: 'pending',
  text: 'Waiting for approval',
})

// Act
const output = await harness.render(block)

// Assert
expect(output).toContain('Waiting for approval')
expect(output).toContain('govuk-tag--yellow')
```

The <s1>authored text in the block</s1> stands in for what an author would write in a
definition, and the <s3>assertions</s3> show that it replaced the default label while
the status still chose the colour.

Keep each test focused on one state. For this component, useful test cases include:

- recognised statuses use the correct default label and colour;
- authored text replaces the default label;
- unknown statuses use the fallback presentation.

## Test how a field presents values and errors

A field component has more to display than a content block: the value someone entered,
and any validation message attached to it. So how do you get an error in front of the
component without submitting an invalid form?

The harness can supply them. Visible failures reach a field component as `errors`,
alongside the prepared field `value`. Pass both through `withValue()`:

```typescript [[1, 11, "withValue('', ["], [1, 12, "{ message: 'Enter a booking reference' }"], [3, 16, "expect(output).toContain('Enter a booking reference')"]]
import { BookingReferenceInput } from './bookingReferenceInput'

// Arrange
const fieldHarness = new FunctionRegistryTestHarness(BookingReferenceInput)
const block = BookingReferenceInput({
  code: 'bookingReference',
  label: 'Booking reference',
})

// Act
const output = await fieldHarness.render(block).withValue('', [
  { message: 'Enter a booking reference' },
])

// Assert
expect(output).toContain('Enter a booking reference')
```

This test checks that the component displays the error it receives. It does not check
whether validation should have failed. That decision happened during evaluation, before the component
rendered, and the <s1>error supplied to the harness</s1> is the result the test hands over.

The same split applies to values. A component test checks how a prepared value is
rendered. A journey test checks how submitted, saved, default, and parsed values become
that prepared value.

## Render a component with its adapter

Try the same test on a component that renders through Nunjucks and its factory needs one
more thing: the environment that holds its templates. Pass it as a dependency to the harness.

The `AppBookingCard` we built in [Adding properties, logic and nested blocks to your
component](./adding-properties-logic-and-nested-blocks-to-your-component) is exactly that kind of component. Pass it a
real Nunjucks environment configured with the same template paths as your application:

```typescript [[5, 6, "nunjucks.configure"], [2, 18, "harness.render(block)"], [3, 21, "expect(output).toContain('Visit to HMP Leeds')"], [3, 22, "app-booking-card__title"]]
import nunjucks from 'nunjucks'
import { AppBookingCard } from './appBookingCard'

it('should render the card title and its details', async () => {
  // Arrange
  const nunjucksEnv = nunjucks.configure([
    'server/views',
    'node_modules/govuk-frontend/dist',
  ])

  const harness = new FunctionRegistryTestHarness(AppBookingCard, { nunjucksEnv })
  const block = AppBookingCard({
    title: 'Visit to HMP Leeds',
    details: [{ label: 'Date', value: '12 May 2026' }],
  })

  // Act
  const output = await harness.render(block)

  // Assert
  expect(output).toContain('Visit to HMP Leeds')
  expect(output).toContain('app-booking-card__title')
})
```

The <s5>configured environment</s5> is real, not mocked, so the test renders the same
templates the application does. The harness supplies it to the factory, the <s2>render call</s2> runs the evaluator, and the
<s3>assertions</s3> stay the same as before.

Other adapters may require different dependencies. Whatever the adapter, the
approach holds: give the harness the dependencies your component expects and assert against its
output.

## Use a journey test for Forge behaviour

Component tests begin after the definition has been evaluated. Anything that happens
during evaluation is out of their reach - and that's the boundary to test against, not
around.

Use a component test when you want to check:

- how evaluated properties become rendered output;
- component-owned defaults and fallbacks;
- how values and validation errors are displayed.

Use a journey test when you want to check:

- whether `visibleWhen` hides a block;
- how field values are prepared;
- whether validation succeeds or fails.

Those behaviours belong to the evaluation pipeline, not the component's evaluator. If a test needs a reference resolved or a decision made before the
component sees its properties, [write a journey test instead](testing-a-journey).

## Recap

You've now tested a component through its ordinary states, its field presentation, and
its adapter, all without evaluating a journey around it.

Let's recap the key points.

- Build a block with concrete props containing the state you want to render; it stands in for
  what evaluation prepares in a real request.
- Pass the component entry to `FunctionRegistryTestHarness` and call `harness.render(block)`.
- Assert against the rendered output, keeping one displayed state per test.
- Pass the real adapter object, such as a configured Nunjucks environment, when the
  component requires one.
- Use component tests for rendering, and journey tests for behaviour that belongs to
  the evaluation pipeline.
