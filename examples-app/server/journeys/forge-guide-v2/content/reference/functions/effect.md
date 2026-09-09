---
title: effect()
slug: effect
section: reference
path: reference/effect
nav: Authoring API/Functions
order: 33
description: Defines a function that performs a side effect during a hook
teaches: [effect, argumentsSchema, factory, dependencies, hooks, context]
prerequisites: []
related:
  concept: how-expressions-work
  how-to: creating-your-own-custom-effect
  reference: access, submit
---

# `effect()`

`effect()` defines a function that performs a side effect - loading data, saving answers, calling a service - during an [access](./access) or [submission](./submit) hook. Effects receive a context object that lets them read and write the request state.

```typescript
import { effect } from '@ministryofjustice/hmpps-forge/core/authoring'

const LoadCaseData = effect('Cases.LoadCaseData', {
  factory: (deps: { caseService: CaseService }) =>
    async (context, caseId: string) => {
      const caseData = await deps.caseService.get(caseId)
      context.setData('case', caseData)
    },
})

// In a journey definition:
onAccess: [access({ effects: [LoadCaseData(Data('caseId'))] })]
```

---

## Reference

### `effect(name, options)`

Creates a named effect. When you use it in a journey definition, it registers itself automatically - no registry or `functions` listing needed.

```typescript
function effect(name: string, options: EffectOptions): EffectEntry
```

You can also omit the name to create an anonymous effect:

```typescript
function effect(options: EffectOptions): EffectEntry
```

#### Options

:::param
---
name: factory
type: "(deps) => (context, ...args) => void | Promise\<void>"
required: true
---
A function that builds the evaluator. The outer function receives your application's
dependencies (or an empty object when there are none). The inner function receives the
hook's context object, followed by any authored arguments, and performs the side effect.

- **`deps`** - your application's dependencies, such as an API client or a service.
- **`context`** - the hook's context object. It provides methods to read and write
  answers, data, session state, request parameters, and response headers. See
  [the context object](#the-context-object) for the full API.
- **`...args`** - the arguments authored at the call site. `LoadCaseData('X123456')`
  passes `'X123456'` as the first argument. Each argument also accepts an expression,
  so `LoadCaseData(Data('caseId'))` works too.

The factory runs during context preparation for each request. It receives the merged
package, adapter, and request dependencies. Duplicate keys across these sources cause an
error. The returned evaluator is called each time the effect runs during a request. Its return value is discarded.
:::

:::param
---
name: argumentsSchema
type: ZodType
required: false
---
Validates the authored arguments at runtime. A failing argument is an authoring mistake,
so it throws rather than running the effect. Also drives arity checking at compilation.

[See adding configuration with arguments.](#add-configuration-with-arguments)
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
evaluator's trailing parameters.
:::

#### Returns

An `EffectEntry` - a function you call with arguments to produce an effect expression.
The expression goes into the `effects` array of an access or submission hook.

The entry also carries the function's metadata (`name`, schemas,
`factory`). When you use it in a journey definition, it registers itself - you don't
need to add it to a registry or a `functions` array.

#### Caveats

- `setData` and `setAnswer` reject non-serializable values. They throw a `TypeError` for
  `Date` objects, class instances, functions, `BigInt`, and `Symbol`. The framework
  enforces plain objects, arrays, and primitives. Dates get a specific message that tells
  you to use an ISO string instead.

- `onAlways` effects run before validation. In a submit hook, the order is: `onAlways`
  effects, then validation, then `onValid`/`onInvalid`. Effects in `onAlways` cannot
  assume the form is valid.

- Access hooks run on POST requests too. Access effects run on every request to the
  step, GET and POST. A load-effect in `onAccess` runs again on submission, before
  submitted answers are prepared.

### The context object

The context gives the effect access to the request state. Here are the most commonly
used methods:

**Answers** - the submitted field values for the current journey:

| Method | Description |
|---|---|
| `context.getAnswer(key)` | Returns the answer for `key`, or `undefined` |
| `context.setAnswer(key, value)` | Sets the answer for `key` |
| `context.getAllAnswers()` | Returns all answers as an object (current values only) |
| `context.hasAnswer(key)` | Returns `true` if an answer exists for `key` |
| `context.clearAnswer(key)` | Removes the answer for `key` |
| `context.getAnswerHistory(key)` | Returns the full mutation history for an answer |
| `context.getAllAnswerHistories()` | Returns all answers with their mutation histories |

**Data** - values loaded for the current request (read-only to the journey configuration):

| Method | Description |
|---|---|
| `context.getData(key)` | Returns the data value for `key`, or `undefined` |
| `context.setData(key, value)` | Sets a data value for `key` |
| `context.getAllData()` | Returns all data as an object |

**Request** - the incoming HTTP request:

| Method | Description |
|---|---|
| `context.getRequestUrl()` | Returns the full request URL |
| `context.getRequestParam(key)` | Returns a route parameter (for example, `:id`) |
| `context.getAllRequestParams()` | Returns all route parameters as an object |
| `context.getQueryParam(key)` | Returns a query string parameter |
| `context.getAllQueryParams()` | Returns all query string parameters as an object |
| `context.getPostData(key)` | Returns a POST body field |
| `context.getAllPostData()` | Returns all POST body fields as an object |
| `context.getSession()` | Returns the session object |
| `context.getState(key)` | Returns a custom request state value |
| `context.getAllState()` | Returns all custom request state as an object |
| `context.getRequestHeader(name)` | Returns a request header value |
| `context.getAllRequestHeaders()` | Returns all request headers as an object |
| `context.getRequestCookie(name)` | Returns a request cookie value |
| `context.getAllRequestCookies()` | Returns all request cookies as an object |

**Response** - outgoing headers and cookies:

| Method | Description |
|---|---|
| `context.setResponseHeader(name, value)` | Sets a response header |
| `context.setResponseCookie(name, value, options?)` | Sets a response cookie |

**Cleardown** - fields marked as stale after submission:

| Method | Description |
|---|---|
| `context.getFieldsToClear()` | Returns the field codes that the cleardown phase resolved as stale. Use this to drop them from your own store when persisting. Empty for access hooks. |

---

## Usage

### Load data on access

The most common use for an effect is loading data when a step is accessed. The effect
calls a service and writes the result into the data context, where fields and
expressions can read it:

```typescript
const LoadCaseData = effect('Cases.LoadCaseData', {
  factory: (deps: { caseService: CaseService }) =>
    async (context, caseId: string) => {
      const caseData = await deps.caseService.get(caseId)
      context.setData('case', caseData)
    },
})
```

Use it in an access hook:

```typescript
onAccess: [
  access({
    effects: [LoadCaseData(Data('caseId'))],
  }),
]
```

The effect runs before the rest of the step's configuration is resolved, so
`Data('case')` is available to fields, conditions, and other expressions.

### Save answers on submission

Effects in a submission hook run after the form is posted. Use them to persist answers
to a service or session:

```typescript
const SaveGoal = effect('Plans.SaveGoal', {
  factory: (deps: { planService: PlanService }) =>
    async (context, planId: string) => {
      const goalDescription = context.getAnswer('goalDescription') as string

      await deps.planService.addGoal(planId, {
        description: goalDescription,
      })
    },
})
```

Place it in the `onValid` branch so it only runs when validation passes:

```typescript
onSubmission: [
  submit({
    validate: true,
    onValid: {
      effects: [SaveGoal(Data('planId'))],
      next: [redirect({ goto: 'confirmation' })],
    },
  }),
]
```

### Run multiple effects in a hook

A hook's `effects` array accepts multiple effects. They run in order:

```typescript
onAlways: {
  effects: [
    SaveAnswers('pre-fill'),
    SaveSubmitStateToSession('pre-fill', true),
    ClearDraftAnswers('pre-fill'),
  ],
  next: [redirect({ goto: 'confirmation' })],
}
```

Each effect sees the state left by the previous one. If the first effect sets an answer,
the second effect can read it.

### Add configuration with arguments

When the same effect serves different steps with different parameters, add arguments
instead of creating separate effects:

```typescript
const LoadAnswers = effect('App.LoadAnswers', {
  argumentsSchema: z.tuple([z.string()]),
  factory: (deps: { formStore: FormStore }) =>
    async (context, patternCode: string) => {
      const sessionId = context.getSession()?.id

      if (!sessionId) {
        return
      }

      const stored = await deps.formStore.get(sessionId, patternCode)

      if (stored) {
        for (const [code, value] of Object.entries(stored)) {
          context.setAnswer(code, value)
        }
      }
    },
})
```

Set the pattern code at the call site:

```typescript
effects: [LoadAnswers('address-lookup')]
```

Arguments also accept expressions, so you can pass a resolved value:

```typescript
effects: [LoadAnswers(Data('currentPattern'))]
```

### Use an application dependency

When an effect needs to call a service, type the factory's `deps` parameter:

```typescript
const AuditAccess = effect('Audit.AuditAccess', {
  factory: (deps: { auditService: AuditService }) =>
    async (context) => {
      await deps.auditService.record({
        url: context.getRequestUrl(),
        user: context.getSession()?.user,
      })
    },
})
```

The dependency is supplied when the application registers the package:

```typescript
forge.registerPackage(appPackage, {
  auditService: services.auditService,
})
```

### Return an asynchronous result

When the evaluator calls an asynchronous service, return a promise. Execution waits
for it before the hook continues:

```typescript
factory: (deps: { caseService: CaseService }) =>
  async (context, caseId: string) => {
    const caseData = await deps.caseService.get(caseId)
    context.setData('case', caseData)
  },
```

Synchronous effects don't need to return a promise - a bare function body works.

---

## Troubleshooting

### The effect doesn't run

Effects can only be used inside hooks. If you place an effect expression outside of an
[`access()`](./access) or [`submit()`](./submit) hook, the semantic validator reports an error. Make sure the
effect appears in the `effects` array of an access or submission hook.

### An argument error is thrown instead of the effect running

The `argumentsSchema` failed. This means the definition passed a value the schema does
not accept. Fix the value at the call site.

### The effect doesn't register

Make sure the effect is actually used in a journey definition. The entry registers
itself when it appears in an `effects` array inside a registered package. Defining the
effect alone does not register it - it needs to be part of a journey.

### Data set by the effect is not available

Check that the effect runs before the step's configuration is resolved. Effects in
`onAccess` run before the page is built, so `setData` values are available. Effects in
`onSubmission` run after the form is posted - if you need the data on the next page, set
it in that page's access hook instead.
