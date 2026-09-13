---
title: Session()
slug: session
section: reference
path: reference/session
nav: Authoring API/References
order: 54
description: References a value from the server-side session
teaches: [session, references, persistence, getSession]
prerequisites: [step, access]
related:
  reference: data, answer
  how-to: creating-your-own-custom-effect
---

# `Session()`

`Session()` references a value from the server-side session. You use it to read values
that persist across requests - a signed-in user's role, a feature flag, or a marker
that a previous step was completed.

```typescript
import { Session } from '@ministryofjustice/hmpps-forge/core/authoring'

// Display a session value
Format('Signed in as %1', Session('user.name'))

// Test a session value
Session('user.role').match(Condition.Equals('admin'))

// Guard on a missing session key
Session('user').not.match(Condition.IsRequired())
```

Unlike [`Data()`](./data), which holds values for a single request, session values
survive across requests. The adapter (for example, express-session) handles persistence
- the engine reads and writes the session object but does not own its storage.

---

## Reference

### `Session(key)`

Creates a reference expression that resolves to a value from the server-side session.

```typescript
function Session(key: string): ChainableRef
```

:::param
---
name: key
type: "string"
required: true
---
The session key to reference. Dot notation navigates into nested values:
`Session('user.role')` reads the `role` property from the `user` session entry.
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
Session('user').path('name')
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
Session('displayName').pipe(
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
Session('displayName').nullish('Not provided')
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
Session('displayName').match(Condition.IsRequired())
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
Session('displayName').not.match(Condition.Equals(''))
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

## Usage

### Display a session value

Use a reference in a component property or a format expression:

```typescript
Format('Signed in as %1 (%2).', Session('user.name'), Session('user.role'))
```

The format string resolves both session values into the displayed text.

### Navigate into a nested value

When a session entry is an object, use dot notation to reach a property:

```typescript
Session('user.role')
```

Each segment uses optional chaining, so a missing intermediate produces `undefined`
rather than an error. `.path()` does the same thing and is useful when chaining after
another operation:

```typescript
Session('user').path('role')
```

### Control visibility with a session value

Test a session value to show or hide content:

```typescript
visibleWhen: Session('user.role').match(Condition.Equals('admin'))
```

This makes the block visible only when the session holds an `admin` role.

### Guard a step on a session value

Use a session reference in a step guard to redirect when a value is missing:

```typescript
when: Session('user').not.match(Condition.IsRequired()),
redirect: '/sign-in',
```

This redirects to sign-in when no `user` key exists in the session.

### Control step reachability

Session values can drive which steps are reachable:

```typescript
step({
  reachability: {
    entryWhen: Session('completedOnboarding').match(Condition.Equals(true)),
  },
  // ...
})
```

The step is reachable only when the session's `completedOnboarding` key is `true`.

### Use a fallback for an absent value

Use `.nullish()` to supply a fallback when the reference resolves to `null` or
`undefined`:

```typescript
Session('displayName').nullish('Guest')
```

This uses `Guest` when the session has no display name. It does not write the
fallback into the session.

Empty strings, `false`, and `0` keep their original value. Forge evaluates the fallback
only when the input is absent. You can also pass another reference or expression as
the fallback.

---

## Writing session values

`Session()` is read-only in expressions. To write a session value, use
`context.getSession()` inside an [effect function](./effect) and mutate the returned object in
place:

```typescript
const saveLoginToSession = effect('Auth.SaveLoginToSession', {
  factory: () => (context) => {
    const session = context.getSession()
    session.user = {
      name: context.getAnswer('userName'),
      role: context.getAnswer('selectedRole'),
    }
  },
})
```

There is no `setSession()` method. The adapter persists the mutated session object
after the request completes.

---

## Troubleshooting

### The session value is always undefined

A missing session key resolves silently to `undefined`. Check two things:

- Does the key string match the property name set in the effect? A mismatched key
  produces `undefined` rather than an error.
- Does the effect that writes the session value run before the expression that reads it?
  A session value set in a submit hook is available on the next request, but not during
  the same request unless an earlier hook in the same phase wrote it.

### Session values disappear between requests

The adapter owns session persistence. If session values disappear, check that the
adapter's session middleware is configured and that its storage backend is working. The
engine reads and writes the session object but does not persist it.
