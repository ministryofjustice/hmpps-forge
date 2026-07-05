---
title: Frequently asked questions
section: get-started
path: get-started/faq
teaches: []
prerequisites: []
---

<p class="govuk-caption-xl">Resources</p>

# Frequently asked questions

Common questions about how Forge works and how to solve typical
problems.

{{slot:toc}}

---

## Where are my answers stored between pages?

Forge is stateless - it does not persist answers for you. When a
user submits a form, Forge validates the submission and runs your
`onSubmission` hooks. If you do not save the answers yourself
(for example, to the session or a database), they are lost when
the request ends.

On the next page load, your `onAccess` hooks run. If you need
answers from a previous step, you must load them back into
context yourself.

This is by design. Forge does not dictate how your service
manages its data. You choose the storage mechanism that fits
your service.

See [Loading, saving and redirecting](../building-journeys/loading-saving-and-redirecting)
for the common patterns.

---

## Why do I need to load answers in onAccess if I already saved them in onSubmission?

Each request is independent. Forge builds a fresh evaluation
context for every GET and every POST. The `onSubmission` hook
from the previous request has already completed and its context
is gone.

The `onAccess` hook for the current request is your opportunity
to populate the context with whatever the step needs - answers
from previous steps, data from APIs, session state. Without it,
the context starts empty.

The typical pattern is:

```typescript
onAccess: [
  access({
    effects: [LoadAnswers()],
  }),
],
onSubmission: [
  submit({
    validate: true,
    onValid: {
      effects: [SaveAnswers()],
      next: [redirect({ goto: '/next-step' })],
    },
  }),
],
```

`LoadAnswers` reads from your store and calls
`context.setAnswer()` for each value. `SaveAnswers` takes the validated
submission and writes it back. Both are effects you define.

---

## What is the difference between a transformer and a generator?

Both produce values at runtime, but they differ in what they
receive as input.

A **transformer** receives a value and returns a new value. It
always operates on an input - the resolved result of whatever
reference it is piped from:

```typescript
FormatFullName: () => (value: unknown) => {
  const { first, last } = value as Name
  return `${first} ${last}`
}
```

You use transformers with `.pipe()` on a reference:

```typescript
Answer('name').pipe(MyTransformers.FormatFullName())
```

A **generator** produces a value from nothing. It has no input
value - it creates something new based on its arguments alone:

```typescript
Today: () => () => {
  return new Date()
}
```

You use generators anywhere a value is expected, without needing
a reference to pipe from:

```typescript
GovUKBody({ text: MyGenerators.Today().pipe(Transformer.Date.Format('D MMMM YYYY')) })
```

In short: transformers convert an existing value, generators
create a new one.

---

## When do I use a condition vs a conditional?

A **condition** tests a single value and returns true or false.
You use it with `.match()` on a reference:

```typescript
Answer('age').match(Condition.Number.GreaterThan(18))
```

This produces a predicate - something that evaluates to true or
false at runtime. Predicates are used in `visibleWhen`,
`validWhen`, `dependentWhen`, and hook `when` guards.

A **conditional** uses a predicate to choose between values.
You use it with `when().then().else()`:

```typescript
when(Answer('age').match(Condition.Number.GreaterThan(18)))
  .then('Adult')
  .else('Minor')
```

This produces a value - a string, object, or whatever you put in
`then` and `else`. Conditionals are used anywhere a value is
expected: block properties, hook arguments, text content.

The distinction: conditions produce booleans, conditionals
produce values.

---

## What is the difference between Data() and Answer()?

Both are references that resolve to values at runtime. The
difference is where the value comes from.

**Answer()** references a value stored via `context.setAnswer()`
or submitted by the user in a form field. Answers are keyed by
field code:

```typescript
Answer('fullName')    // the user's response to the 'fullName' field
Answer('email')       // the user's response to the 'email' field
```

**Data()** references a value stored via `context.setData()` in
an effect. Data is keyed by whatever name you choose:

```typescript
Data('case')          // loaded by an effect: context.setData('case', ...)
Data('case.status')   // nested path into that data
```

Use `Answer()` for user-submitted form values. Use `Data()` for
anything loaded from external sources - API responses, reference
data, computed values set in effects.

---

## What is the difference between Answer() and Post()?

**Answer()** references a stored answer - a value that was
submitted on a previous (or current) step and loaded into
context via `context.setAnswer()`. It works on both GET and
POST requests because it reads from the evaluation context, not
the request body:

```typescript
Answer('email')    // the stored answer for the 'email' field
```

**Post()** references the raw request body of the current POST
request. It only has a value during form submission - on GET
requests it resolves to undefined:

```typescript
Post('action')     // the value of an 'action' field in the form body
```

The most common use for `Post()` is distinguishing which button
the user pressed when a step has multiple submit actions:

```typescript
submit({
  when: Post('action').match(Condition.Equals('delete')),
  onAlways: {
    effects: [DeleteItem()],
    next: [redirect({ goto: '/items' })],
  },
})
```

Do not use `Post()` in places that evaluate on GET requests
(like `visibleWhen`, `next` outcomes evaluated during
reachability, or redirect conditions) - it will always be
undefined there.

---

## How do I get data from an API into my blocks?

Three steps:

1. **Define an effect** that calls the API and stores the result:

```typescript
LoadCase: (deps) => async (context, caseId: string) => {
  const data = await deps.caseApi.getCase(caseId)
  context.setData('case', data)
}
```

2. **Call the effect in onAccess** so it runs when the page loads:

```typescript
onAccess: [
  access({
    effects: [MyCaseEffects.LoadCase(Params('caseId'))],
  }),
],
```

3. **Reference the data in your blocks** using `Data()`:

```typescript
GovUKHeading({ text: Data('case.person.firstName'), size: 'l' })
```

The effect loads the data into context. `Data()` creates a
reference to it. At render time, Forge resolves the reference
and passes the value to the component.

See [Loading, saving and redirecting](../building-journeys/loading-saving-and-redirecting)
for more patterns.

---

## Why is my step unreachable?

Forge evaluates a reachability graph on every request. A step
is reachable only if there is a path to it from an entry point
through evaluated forward edges. If no path exists, Forge
redirects to the journey's entry point - or to the frontier
(the furthest reachable step) if the journey sets
`reachability: { unreachableRedirect: 'frontier' }`.

Common causes:

- **No entry point defined.** At least one step needs
  `reachability: { entryWhen: true }` to seed the graph.
- **No forward edge leads to the step.** Forward edges come from
  `next` outcomes in `onSubmission` hooks. If no hook on a
  preceding step points to your step's path, the graph cannot
  reach it.
- **A condition on the forward edge evaluates to false.** If a
  `when` guard on a `next` outcome is not met, that edge is not
  followed.
- **The step is defined but not registered.** Check that it
  appears in the journey's `steps` array.

See [Reachability](../building-journeys/reachability) for the
full explanation of how the graph is built and evaluated.

---

## What is the difference between entryWhen and resumeWhen?

Both control how users enter a step, but they live at different
levels: `entryWhen` sits on a step's `reachability`, `resumeWhen`
sits on the journey's.

**entryWhen** marks a step as a starting point for the
reachability graph. When it evaluates to true, Forge includes
that step as a root node. The graph walks forward from all entry
points to determine which steps are reachable.

Most journeys have a single entry point - the first step:

```typescript
reachability: { entryWhen: true }
```

**resumeWhen** is set on the journey's `reachability` and adds
redirect-to-frontier behaviour. When its
condition is active, Forge redirects the user to the frontier -
the furthest incomplete step on the reachable path - instead of
letting them stay on their current step. This is useful for
task list patterns where a link should take the user back to
where they left off.

A typical use is a conditional resume triggered by a query
parameter, set on the journey definition:

```typescript
reachability: {
  resumeWhen: Query('resume').match(Condition.Equals('true')),
}
```

Task list links include `?resume=true` to trigger the redirect.
Change links on check-answers pages omit it, allowing the user
to land on the specific step they chose.

In short: `entryWhen` seeds the reachability graph.
`resumeWhen` redirects users to their frontier when active.

---

## Can I use Forge without GOV.UK Frontend?

Yes. Forge's core engine has no dependency on GOV.UK Frontend,
Nunjucks, or Express. The `@ministryofjustice/hmpps-forge/core`
entry point is framework-agnostic.

The GOV.UK and MOJ component packages
(`/govuk-components`, `/moj-components`) are optional
registrations that provide pre-built block variants mapped to
those design systems. If you do not register them, Forge will
not use them.

You can build your own components using `buildComponent()` from
`@ministryofjustice/hmpps-forge/core/components` and register
them with your own variants.
The framework adapter handles rendering - if you write a custom
adapter, you can target any templating system.

See [Building custom components](../building-functions-and-components/custom-components)
for the full component authoring guide.

---

## How do I add custom middleware that runs before Forge?

Forge mounts its routes through a framework adapter. In the
Express adapter, `createExpressRouter(forge, { nunjucksEnv })`
returns a standard Express router. You mount it like any other
router:

```typescript
const forgeRouter = createExpressRouter(forge, { nunjucksEnv })

app.use(myMiddleware, forgeRouter)
```

Any middleware you place before the Forge router in the Express
chain will run before Forge handles the request. This includes
authentication, session setup, logging, or anything else your
service needs.

For logic that should run on every step within a journey, use a
journey-level `onAccess` hook instead. Hooks have access to the
Forge evaluation context, which middleware does not.

---

## How can I access data from my Express middleware?

Store data in `res.locals` or `req.state` in your middleware.
The express-nunjucks adapter copies these into the evaluation
context, making them available to your journey through the
`Request.State()` reference.

---

## I'm using Answer() in my custom generator/transformer, why isn't it working?

`Answer()`, `Data()`, and other reference helpers are part of
the definition layer. They produce pointer objects that Forge
resolves during evaluation. Inside a registered function body,
Forge does not process what you write - it just calls your
function and uses the return value.

If you call `Answer('name')` inside a transformer, you get back
a definition object, not the user's answer:

```typescript
// ✗ This does not work
MyTransformer: () => (value: unknown) => {
  const name = Answer('name')  // returns a pointer, not a string
  return `${name}: ${value}`   // "[object Object]: ..."
}
```

Instead, use the value Forge passes into your function, or pass
additional values in as arguments from the definition side:

```typescript
// ✓ Transformer: use the value Forge gives you
MyTransformer: () => (value: unknown) => {
  return `${value} - transformed`
}

// Wire it up in the definition:
Answer('name').pipe(MyTransformers.MyTransformer())
```

```typescript
// ✓ Generator: use the arguments Forge resolves for you
Greeting: () => (name: string) => {
  return `Hello, ${name}`
}

// Pass the reference as an argument in the definition:
MyGenerators.Greeting(Answer('name'))
```

See [Definitions and runtime](../building-journeys/definitions-and-runtime)
for a full explanation of the boundary between definition-time
and runtime code.
