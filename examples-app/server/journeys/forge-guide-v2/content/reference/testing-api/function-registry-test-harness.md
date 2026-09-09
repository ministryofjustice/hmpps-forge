---
title: FunctionRegistryTestHarness
slug: function-registry-test-harness
section: reference
path: reference/function-registry-test-harness
nav: Testing API
order: 101
description: Evaluates functions and renders components in unit tests
teaches: [FunctionRegistryTestHarness, evaluate, withInput, withContext, render, withValue, function-handles, dependency-substitution]
prerequisites: []
related:
  concept: how-expressions-work
  reference: forge-test-harness
  how-to: testing-a-function
---

# `FunctionRegistryTestHarness`

`FunctionRegistryTestHarness` evaluates functions using Forge's schema checks,
missing-input behaviour, and output validation. It also renders components through the
recursive rendering pipeline.

```typescript
const harness = new FunctionRegistryTestHarness(bookingConditionRegistry)

const result = harness
  .evaluate(BookingConditions.IsLongEnough(60))
  .withInput(90)
```

---

## Reference

### `new FunctionRegistryTestHarness(functions, deps?)`

Create a harness from function entries, component entries, registries, or a mixture.
The harness binds their factories immediately with the supplied dependencies, making
them available to `evaluate()` or `render()`.

[See a complete setup below.](#build-a-harness-from-a-registry)

```typescript
class FunctionRegistryTestHarness<TDeps = Record<string, never>> {
  constructor(
    functions: BaseFunctionRegistry<TDeps> | FunctionEntry | (BaseFunctionRegistry<TDeps> | FunctionEntry)[],
    deps?: TDeps,
  )
}
```

#### Parameters

:::param
---
name: functions
type: BaseFunctionRegistry<TDeps> | FunctionEntry | (BaseFunctionRegistry<TDeps> | FunctionEntry)[]
required: true
---
A standalone function or component entry, a registry, or an array mixing them. Pass
the entries used by the application. Standalone entries sharing a name are disambiguated
by identity. Duplicate names across built registries throw.
:::

:::param
---
name: deps
type: TDeps
required: false
---
Dependencies supplied when the harness builds the registries. Omit this when their
functions require no dependencies.

In tests, pass substitutes or mocks with the same
shape as the application's dependencies. When `functions` is an array, the same
dependencies are supplied to every registry in it.
:::

### `evaluate(expr)`

Select a registered function using its author-facing handle. What happens next depends
on the function type:

| Function type | Evaluation call | Result |
| --- | --- | --- |
| Condition | `evaluate(handle).withInput(value)` | The condition result |
| Transformer | `evaluate(handle).withInput(value)` | The transformed value |
| Generator | `evaluate(handle)` | The generated value |
| Effect | `evaluate(handle).withContext(context)` | The effect result |

```typescript
evaluate(expr: ConditionFunctionExpr): {
  withInput(value: unknown): unknown
}

evaluate(expr: TransformerFunctionExpr): {
  withInput(value: unknown): unknown
}

evaluate(
  expr: GeneratorFunctionExpr | ChainableGenerator,
): unknown

evaluate(expr: EffectFunctionExpr): {
  withContext(context: EffectFunctionContext): unknown
}
```

#### Parameters

:::param
---
name: expr
type: ConditionFunctionExpr | TransformerFunctionExpr | GeneratorFunctionExpr | ChainableGenerator | EffectFunctionExpr
required: true
---
The value returned by calling a standalone entry or a registry handle, such as
`BookingConditions.IsLongEnough(60)`. The handle identifies the registered function and
contains its authored arguments.

Pass the handle value, not the registry entry's evaluator or factory. The harness uses
the handle's function name to find the implementation built from its registries.
:::

#### Returns

For a condition or transformer, an object with `withInput()`. For an effect, an object
with `withContext()`. For a generator, the generated result immediately.

If the registered evaluator is asynchronous, the eventual result is a promise. Await it
before inspecting the value or any effect mutations.

### `withInput(value)`

Supply the value that Forge would inject into a condition or transformer at runtime.
This is separate from the authored arguments already held by the function handle.

```typescript
harness.evaluate(conditionExpr).withInput(value)
harness.evaluate(transformerExpr).withInput(value)
```

#### Parameters

:::param
---
name: value
type: unknown
required: true
---
The input to test. Forge checks it against the function's configured `inputSchema`
before calling the evaluator.

A `null` or `undefined` condition input short-circuits to `false`. A transformer
receiving either returns `undefined`. Both skip the input schema and evaluator.
:::

#### Returns

The condition or transformer result, after output validation. Asynchronous evaluators
return a promise for that result.

A condition whose defined input fails its `inputSchema` returns `false`. A transformer
whose input fails its schema throws a `TypeError`.

### `withContext(context)`

Supply the request context that Forge would inject into an effect at runtime.

```typescript
harness.evaluate(effectExpr).withContext(context)
```

#### Parameters

:::param
---
name: context
type: EffectFunctionContext
required: true
---
The effect context to read or change. Use `createTestEffectContext()` to build an
in-memory context with the answers, data, session, and request values needed by the
test.

[See supplying dependencies and an effect context below.](#supply-dependencies-and-an-effect-context)
:::

#### Returns

The effect's return value. An asynchronous effect returns a promise; await it before
inspecting dependency calls or context changes.

### `render(block)`

Render a component call with concrete props. Nested child components render before their
parents, using the same recursive boundary as a journey request.

```typescript
render(block: BlockDefinition): Promise<unknown>
render(block: FieldBlockDefinition): FieldComponentTestInvocation
```

:::param
---
name: block
type: BlockDefinition | FieldBlockDefinition
required: true
---
A block authored by a component supplied to the harness. Supply entries for nested
components too. Props must be concrete values; expression resolution requires `ForgeTestHarness`.
:::

A basic block returns a promise for its output. A field returns an invocation accepting
`withValue()`.

### `withValue(value, errors?)`

Supply the runtime value and optional validation errors for a field component:

```typescript
withValue(value: unknown, errors?: readonly ComponentTestError[]): Promise<unknown>
```

:::param
---
name: value
type: unknown
required: true
---
The field value passed to the component. Answer preparation and validation do not run.
:::

:::param
---
name: errors
type: readonly ComponentTestError[]
required: false
---
Errors to display. Each has a `message` string and optional `details` object. When omitted,
no errors are supplied to the field.
:::

Returns a promise for the rendered field output.

---

## Usage

### Build a harness from standalone entries

Pass the entry directly when testing a function declared with `condition()`,
`transformer()`, `generator()`, or `effect()`:

```typescript
const IsLongEnough = condition('IsLongEnough', {
  factory: () => (value: number, minimum: number) => value >= minimum,
})

const harness = new FunctionRegistryTestHarness(IsLongEnough)

expect(harness.evaluate(IsLongEnough(60)).withInput(90)).toBe(true)
```

### Render a field component

Supply the component's dependencies to the harness, then provide its runtime value:

```typescript
const harness = new FunctionRegistryTestHarness(GovUKTextInput, { nunjucksEnv })

const output = await harness
  .render(GovUKTextInput({ code: 'email', label: 'Email address' }))
  .withValue('person@example.com', [{ message: 'Enter a different email address' }])
```

### Evaluate each function type

Create each harness from the registry that owns the function, then use the evaluation
shape for that function type:

```typescript
const conditionResult = conditionHarness
  .evaluate(BookingConditions.IsLongEnough(60))
  .withInput(90)

const transformedValue = transformerHarness
  .evaluate(BookingTransformers.FormatReference())
  .withInput('ab 1234')

const generatedValue = generatorHarness.evaluate(
  BookingGenerators.BuildReference('visit', 42),
)

await effectHarness
  .evaluate(BookingEffects.SaveBooking())
  .withContext(context)
```

Synchronous functions return their result directly. Asynchronous functions return a
promise.

### Supply dependencies and an effect context

Pass a <s1>substituted dependency</s1> to the constructor and a <s2>test context</s2> to
the effect:

```typescript [[1, 1, "bookingStore"], [1, 5, "bookingStore"], [2, 7, "createTestEffectContext"], [2, 15, "withContext(context)"]]
const bookingStore = {
  save: vi.fn().mockResolvedValue(undefined),
}

const harness = new FunctionRegistryTestHarness(bookingEffectRegistry, { bookingStore })

const context = createTestEffectContext({
  answers: { visitType: 'video' },
  data: { bookingId: 'booking-123' },
  session: { userId: 'user-7' },
})

await harness
  .evaluate(BookingEffects.SaveBooking())
  .withContext(context)

expect(context.getAnswer('bookingStatus')).toBe('saved')
```

The dependency controls the external boundary. The context supplies request state and
records what the effect changes.

For complete test examples, see
[Testing a function](../how-to-guides/testing-a-function).

---

## Troubleshooting

### The harness reports `Function "..." is not registered in this harness`

The function handle names an implementation that does not exist in any registry passed
to the harness. This often means the handle and registry were imported from different
function groups.

Create the harness with the entry or registry that created the handle. The error also lists the
function names that are available in the current harness.

### The constructor reports a function registered more than once

Two registries passed to the harness contain the same function name. The harness cannot
choose which implementation the handle should evaluate.

Rename one of the registrations, or use separate harnesses when the registries are not
intended to share one function namespace.

### A condition returns `false` without calling its evaluator

Conditions short-circuit to `false` when their input is `null` or `undefined`, or a present value
fails the configured `inputSchema`. This matches Forge's normal condition behaviour.

Pass an accepted input when the test is about the evaluator itself. If the short-circuit
is the behaviour under test, assert `false` and that the evaluator's dependency was not
called.

### A transformer returns `undefined` without calling its evaluator

Transformers short-circuit when `withInput(null)` or `withInput(undefined)` is used. There is no value to
transform, so Forge returns `undefined` without invoking the registered evaluator.

Pass a non-null, defined value to exercise the transformer.

### An assertion runs before an asynchronous function finishes

An asynchronous condition, transformer, generator, or effect returns a promise. Await
the result before checking its value, dependency calls, or context changes.

Synchronous errors throw from the evaluation call; asynchronous errors reject its
promise.

### A function receives a Forge expression instead of a resolved value

The harness evaluates one registered function directly. It does not run a journey to
resolve authored references such as `Answer()`, `Data()`, or `Query()` inside the
function's arguments.

Pass concrete arguments to the function handle for a direct unit test. Use
`ForgeTestHarness` when the behaviour under test depends on request state, reference
resolution, hooks, or the wider journey lifecycle.
