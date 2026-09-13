---
title: Data()
slug: data
section: reference
path: reference/data
nav: Authoring API/References
order: 53
description: References values from the request's data context
teaches: [data, references, static-data, hooks, setData]
prerequisites: [step, access]
related:
  reference: answer, self, session
  how-to: creating-your-own-custom-effect
---

# `Data()`

`Data()` references a value from the request's data context. You use it to read values
that access hooks loaded, static data declared on a journey or step, or anything an
effect wrote with `setData()`.

```typescript
import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'

// Display a loaded value
GovUKHeading({ text: Data('caseTitle') })

// Test a loaded value
Data('isPremium').match(Condition.Equals(true))

// Navigate into a nested value
Data('user.name')
```

Unlike [`Answer()`](./answer), which reads values that somebody entered into a field,
`Data()` reads values that the application provided - loaded from an API, declared in
configuration, or set by an effect during the request.

---

## Reference

### `Data(key)`

Creates a reference expression that resolves to a value from the request's data context.

```typescript
function Data(key: string): ChainableRef
```

:::param
---
name: key
type: "string"
required: true
---
The data key to reference. Dot notation navigates into nested values:
`Data('user.name')` reads the `name` property from the `user` data entry.
:::

#### Returns

A `ChainableRef` - an immutable expression builder you can use directly as a value or
chain with the methods below.

### Methods

#### `.path(key)`

Navigates deeper into the referenced value.

```typescript
path(key: string): ChainableRef
```

:::param
---
name: key
type: "string"
required: true
---
The property to read from the resolved value. Dot notation navigates through
nested properties. A missing intermediate value resolves to `undefined` rather
than throwing an error.
:::

```typescript
Data('case').path('title')
```

Use `.path()` after another operation when you need to read a property from its
result.

#### `.pipe(...steps)`

Passes the referenced value through one or more [transformers](./transformer) in sequence.

```typescript
pipe(...steps: TransformerFunctionExpr[]): ChainableExpr
```

:::param
---
name: steps
type: "TransformerFunctionExpr[]"
required: false
---
The transformers to apply, passed as separate arguments in execution order. Each
transformer receives the previous step's output. With no arguments, the expression
keeps its value.
:::

Pass multiple transformers to apply them in sequence:

```typescript
Data('caseTitle').pipe(
  Transformer.String.Trim(),
  Transformer.String.ToLowerCase(),
)
```

When the value is absent, the pipeline is skipped and the expression stays absent.
The pipeline produces a value for this expression without changing the source value.

The returned expression continues the chain with `.path()`, `.pipe()`, `.nullish()`,
`.match()`, or `.each()`. Use `.not.match()` to negate a condition on its result.

#### `.nullish(fallback)`

Uses a fallback when the referenced value resolves to `null` or `undefined`.

```typescript
nullish(fallback: ResolvableValue | undefined): ChainableExpr
```

:::param
---
name: fallback
type: "ResolvableValue | undefined"
required: true
---
The value to use when the input resolves to `null` or `undefined`. Accepts a literal,
another reference, a generator call, or another value expression. Passing `undefined`
leaves a missing result absent.
:::

The fallback can be a fixed value or another expression:

```typescript
Data('caseTitle').nullish('Not provided')
```

Forge evaluates the input once and evaluates the fallback only when the input is
`null` or `undefined`.

Empty strings, `false`, `0`, empty arrays, and empty objects keep their original value.
The returned expression continues the chain with `.path()`, `.pipe()`, `.match()`,
`.each()`, or another `.nullish()`. It does not change the source value.

`.nullish()` does not catch errors. If the input throws, that error propagates without
running the fallback. References in the fallback still follow their normal scope rules;
for example, `Loop.Item()` needs an enclosing iterator.

#### `.match(condition)`

Tests the referenced value against a [condition](./condition). Returns an expression
that resolves to a boolean and can be used wherever a resolvable value is accepted.

```typescript
match(condition: ConditionFunctionExpr): PredicateTestExpr
```

:::param
---
name: condition
type: "ConditionFunctionExpr"
required: true
---
The condition to test against the resolved value. Pass a built-in condition such as
`Condition.IsRequired()`, or a custom condition entry. The resolved value becomes
the condition's `value` argument.
:::

For example, test whether the value is present:

```typescript
Data('caseTitle').match(Condition.IsRequired())
```

Use the result in `when`, `validWhen`, `visibleWhen`, or anywhere else that a
boolean/predicate is accepted.

#### `.not`

Negates the next `.match()`. This is a property, not a method - no parentheses needed.

```typescript
readonly not: ChainableNegation
```

`.not` takes no parameters.

```typescript
Data('caseTitle').not.match(Condition.Equals(''))
```

After `.not`, only `.match()` and another `.not` are available. You cannot `.pipe()` or
`.path()` after negation. `.not.not` cancels itself out.

#### `.each(iterator)`

Iterates over the referenced value when it contains an array or collection.

```typescript
each(iterator: MapIteratorConfig | FilterIteratorConfig): ChainableIterable
each(iterator: FindIteratorConfig): ChainableExpr
each(iterator: SomeIteratorConfig | EveryIteratorConfig): CollectionPredicateExpr
each(iterator: CountIteratorConfig): ChainableExpr
```

:::param
---
name: iterator
type: "IteratorConfig"
required: true
---
The per-item operation to perform. Create it with `Iterator.Map()`,
`Iterator.Filter()`, `Iterator.Find()`, `Iterator.Some()`, `Iterator.Every()`, or
`Iterator.Count()`. Item references and predicates resolve within that iteration.
:::

The iterator determines the result: an iterable (`Map` and `Filter`), a single value
(`Find`), a predicate (`Some` and `Every`), or a chainable number (`Count`).

See [`Iterator`](./iterator) for configuration and usage.

---

## Where data comes from

The data context combines two sources for each request.

### Static data on journeys and steps

Declare a `data` object on a [journey](./journey) or [step](./step) definition to set values that don't change
between requests:

```typescript
const caseJourney = journey({
  data: {
    serviceName: 'Case management',
    maxFileSize: 10,
  },
  steps: [overviewStep, detailStep],
})
```

A step can declare its own `data` too:

```typescript
const overviewStep = step({
  data: {
    pageVariant: 'summary',
  },
  // ...
})
```

When a journey and its steps both declare data, the values merge root-first. A step's
key overrides the same key from its parent journey.

Static data accepts plain values only. Expressions like `Answer()` or `Data()` are
rejected at registration.

### Effect functions in hooks

[Access hooks](./access) and [submit hooks](./submit) can write data with `context.setData()`:

```typescript
const loadCaseData = effect('Case.LoadCaseData', {
  factory: (deps: { caseService: CaseService }) => async (context) => {
    const caseData = await deps.caseService.getCase(context.getAnswer('caseNumber'))
    context.setData('caseTitle', caseData.title)
    context.setData('caseStatus', caseData.status)
  },
})
```

Once an effect writes a key, any `Data()` reference to that key resolves to the written
value for the rest of the request.

Values written with `setData()` must be serializable. Objects and arrays work, but
functions, class instances, and circular structures do not.

---

## Usage

### Display a data value

Pass a reference directly to a component property:

```typescript
GovUKHeading({
  text: Data('caseTitle'),
  size: 'l',
})
```

The heading displays whatever the `caseTitle` data key holds for this request.

### Navigate into a nested value

When a data entry is an object, use dot notation to reach a property:

```typescript
Data('user.name')
```

Each segment uses optional chaining, so a missing intermediate produces `undefined`
rather than an error. `.path()` does the same thing and is useful when chaining after
another operation:

```typescript
Data('user').path('name')
```

### Transform a data value with a pipeline

Use `.pipe()` to reshape a value without changing the stored data:

```typescript
Data('caseTitle').pipe(
  Transformer.String.Trim(),
  Transformer.String.ToUpperCase(),
)
```

When the data key is absent, the pipeline is skipped and the expression stays absent.

### Test a data value with a condition

`.match()` tests the resolved value and returns a predicate:

```typescript
when: Data('isPremium').match(Condition.Equals(true))
```

Use the result in `when`, `visibleWhen`, `reachability.entryWhen`, or anywhere else a
predicate is accepted.

### Control navigation with data

Data values can drive redirects and step reachability:

```typescript
redirect({
  when: Data('skipValidation').match(Condition.Equals(true)),
  goto: 'exit',
})
```

```typescript
step({
  reachability: {
    entryWhen: Data('isPremium').match(Condition.Equals(true)),
  },
  // ...
})
```

### Iterate over a data collection

When a data entry holds an array, use `.each()` to iterate:

```typescript
collection: Data('members').each(memberIterator)
```

See [`iterator`](./iterator) for configuration and usage.

### Use a fallback for an absent value

Use `.nullish()` to supply a fallback when the reference resolves to `null` or
`undefined`:

```typescript
Data('caseTitle').nullish('Untitled case')
```

The fallback supplies display text when the data property is absent. It does not
write a title into request data.

Empty strings, `false`, and `0` keep their original value. Forge evaluates the fallback
only when the input is absent. You can also pass another reference or expression as
the fallback.

---

## Troubleshooting

### The data value is always undefined

A missing data key resolves silently to `undefined`. Check two things:

- Does the key string match what was declared in `data` or written with `setData()`? A
  mismatched key produces `undefined` rather than an error.
- If an access hook loads the data, does that hook run before the expression that reads
  it? Effects in a hook run before that hook's outcomes are evaluated, but a `Data()`
  reference in a different hook or a block that renders before the hook finishes will
  not see the value yet.

### Static data rejects an expression

Static `data` on a journey or step accepts plain values only. If you pass an expression
like `Answer('x')` or `Data('y')`, registration rejects it. To set a data value from
an expression, use an access hook effect with `context.setData()` instead.

### Data does not persist across requests

Data lives for one request only. A value written with `setData()` during an access hook
is available for the rest of that request, but it does not survive a form submission or
a page reload. Use [`Session()`](./session) or another appropriately scoped store to hold values
across requests.
