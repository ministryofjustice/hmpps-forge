---
title: generator()
slug: generator
section: reference
path: reference/generator
nav: Authoring API/Functions
order: 32
description: Defines a function that produces a value without input
teaches: [generator, argumentsSchema, factory, dependencies, built-in-generators, pipe, match]
prerequisites: []
related:
  concept: how-expressions-work
  how-to: creating-your-own-custom-generator
  reference: transformer, condition
---

# `generator()`

`generator()` defines a function that produces a value. You use generators as dynamic values in journey definitions: default values, dates, formatted strings, and anything else that needs to be computed at request time.

```typescript
import { generator } from '@ministryofjustice/hmpps-forge/core/authoring'

const NewReferenceNumber = generator('Cases.NewReferenceNumber', {
  argumentsSchema: z.tuple([z.string()]),
  factory: () => (prefix: string) => `${prefix}-${Date.now()}`,
})

// In a journey definition:
GovUKTextInput({
  code: 'caseReference',
  defaultValue: NewReferenceNumber('REF'),
})
```

---

## Reference

### `generator(name, options)`

Creates a named generator. When you use it in a journey definition, it registers itself automatically - no registry or `functions` listing needed.

```typescript
function generator(name: string, options: GeneratorOptions): GeneratorEntry
```

You can also omit the name to create an anonymous generator:

```typescript
function generator(options: GeneratorOptions): GeneratorEntry
```

#### Options

:::param
---
name: factory
type: "(deps) => (...args) => output | Promise\<output>"
required: true
---
A function that builds the evaluator. The outer function receives your application's
dependencies (or an empty object when there are none). The inner function receives the
authored arguments and returns the generated value.

- **`deps`** - your application's dependencies, such as an API client or a service.
- **`...args`** - the arguments authored at the call site. `NewReferenceNumber('REF')`
  passes `'REF'` as the first argument. Each argument also accepts an expression, so
  `NewReferenceNumber(Data('referencePrefix'))` works too.

The factory runs during context preparation for each request. It receives the merged
package, adapter, and request dependencies. Duplicate keys across these sources cause an
error. The returned evaluator is called each time the generator runs during a request.
:::

:::param
---
name: argumentsSchema
type: ZodType
required: false
---
Validates the authored arguments at runtime. A failing argument is an authoring mistake,
so it throws rather than returning a result. Also drives arity checking at compilation.

[See adding configuration with arguments.](#add-configuration-with-arguments)
:::

:::param
---
name: outputSchema
type: ZodType
required: false
---
Validates the evaluator's return value. Use this when downstream code depends on the
output having a specific shape - for example, when a field expects a `Date` object
rather than a string.
:::

:::param
---
name: prepare
type: "(...args) => unknown[]"
required: false
---
Transforms the authored arguments before they are embedded in the expression. It runs
once at definition time (when the module loads), not on every request. Use it to
validate arguments early or to reshape them into a different form for the evaluator.

When present, its parameter types become the entry's call signature instead of the
evaluator's parameters.
:::

#### Returns

A `GeneratorEntry` - a function you call with arguments to produce a chainable
generator expression. The expression can be used directly as a value, piped through
transformers with `.pipe()`, or tested with `.match()`.

The entry also carries the function's metadata (`name`, schemas,
`factory`). When you use it in a journey definition, it registers itself - you don't
need to add it to a registry or a `functions` array.

#### Caveats

- Schemas validate values without transforming them. Evaluators receive the original
  input and arguments, and their original return value is preserved.

- Each occurrence of a generator expression runs independently. The same generator used
  in two places in a step runs twice per request with no shared result. A generator that
  is not pure can return different values for each occurrence.

---

## Usage

### Create a generator that produces a value

The simplest generator takes no arguments and returns a value:

```typescript
const CurrentYear = generator('App.CurrentYear', {
  factory: () => () => new Date().getFullYear(),
})
```

Use it anywhere a dynamic value is accepted:

```typescript
GovUKTextInput({
  code: 'taxYear',
  defaultValue: CurrentYear(),
})
```

The generator runs at request time, so the value is always current.

### Add configuration with arguments

When the same generator serves different purposes with different parameters, add
arguments instead of creating separate generators:

```typescript
const NewReferenceNumber = generator('Cases.NewReferenceNumber', {
  argumentsSchema: z.tuple([z.string()]),
  factory: () => (prefix: string) => `${prefix}-${Date.now()}`,
})
```

Set the prefix at the call site:

```typescript
defaultValue: NewReferenceNumber('REF')
```

Arguments also accept expressions, so you can pass a resolved value:

```typescript
defaultValue: NewReferenceNumber(Data('referencePrefix'))
```

### Pipe the output through transformers

A generator returns a chainable expression. Call `.pipe()` to transform the result
before it reaches the journey:

```typescript
Generator.Date.Today().pipe(
  Transformer.Date.Format('D MMMM YYYY'),
)
```

The generator produces a `Date` object. The transformer formats it into a readable
string like "18 March 2026". You can chain as many transformers as you need - each one
receives the output of the previous.

A common pattern is generating a date and formatting it for a date picker's constraints:

```typescript
MOJDatePicker({
  code: 'appointmentDate',
  minDate: Generator.Date.Today().pipe(
    Transformer.Date.Format('DD/MM/YYYY'),
  ),
  maxDate: Generator.Date.Today().pipe(
    Transformer.Date.AddDays(30),
    Transformer.Date.Format('DD/MM/YYYY'),
  ),
})
```

### Test the output with a condition

Call `.match()` to test the generated value against a condition:

```typescript
FeatureFlag('showNewSection').match(Condition.Equals(true))
```

This produces a predicate expression you can use in `when` or `visibleWhen` to control
whether part of a journey is active.

### Use an application dependency

When a generator needs to call a service - fetching a feature flag from a remote store,
for example - type the factory's `deps` parameter:

```typescript
const FeatureFlag = generator('App.FeatureFlag', {
  argumentsSchema: z.tuple([z.string()]),
  factory: (deps: { featureService: FeatureService }) =>
    async (flagName: string) => {
      return deps.featureService.isEnabled(flagName)
    },
})
```

The dependency is supplied when the application registers the package:

```typescript
forge.registerPackage(appPackage, {
  featureService: services.featureService,
})
```

### Return an asynchronous result

When the evaluator calls an asynchronous service, return a promise. Evaluation waits
for it before the generated value is used:

```typescript
factory: (deps: { featureService: FeatureService }) =>
  async (flagName: string) => {
    return deps.featureService.isEnabled(flagName)
  },
```

Synchronous generators don't need to return a promise - a plain value works.

---

## Built-in generators

The `Generator` namespace provides ready-made generators for common tasks.

```typescript
import { Generator } from '@ministryofjustice/hmpps-forge/core/authoring'

Generator.Date.Today()
Generator.Date.Now()
Generator.FormatString('Case %1 - %2', Answer('caseId'), Answer('caseName'))
```

### Date

| Generator | Result |
|---|---|
| `Generator.Date.Now()` | The current date and time as a `Date` object |
| `Generator.Date.Today()` | Today's date at midnight (00:00:00.000) as a `Date` object |

### FormatString

| Generator | Result |
|---|---|
| `Generator.FormatString(template, ...values)` | A string built from a template with `%1`, `%2` positional placeholders |

Placeholders are 1-indexed. Unmatched placeholders are left in the output as-is.
`undefined` replacements become empty strings.

```typescript
Generator.FormatString(
  '%1 %2 (ref: %3)',
  Answer('firstName'),
  Answer('lastName'),
  Data('caseReference'),
)
// produces: "Jane Smith (ref: REF-001)"
```

---

## Troubleshooting

### An argument error is thrown instead of the generator running

The `argumentsSchema` failed. This means the definition passed a value the schema does
not accept. Fix the value at the call site.

### The generator doesn't register

Make sure the generator is actually used in a journey definition. The entry registers
itself when it appears in a property value, a `when` expression, or similar context
inside a registered package. Defining the generator alone does not register it - it
needs to be part of a journey.

### The generated value has the wrong type

If downstream code expects a specific type (for example, a date picker that needs a
formatted string rather than a `Date` object), pipe the output through a transformer:

```typescript
Generator.Date.Today().pipe(Transformer.Date.Format('DD/MM/YYYY'))
```

The generator produces the raw value, and the transformer converts it into the shape the
consumer expects.
