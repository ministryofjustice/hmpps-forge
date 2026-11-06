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

```rust
"onAccess": [access(obj! {
    "effects": [effect::call("LoadAnswers", vec![])],
})],
"onSubmission": [submit(obj! {
    "validate": true,
    "onValid": obj! {
        "effects": [effect::call("SaveAnswers", vec![])],
        "next": [redirect(obj! { "goto": "/next-step" })],
    },
})],
```

`LoadAnswers` reads from your store and calls
`context.set_answer()` for each value. `SaveAnswers` takes the validated
submission and writes it back. Both are effects you define.

---

## What is the difference between a transformer and a generator?

Both produce values at runtime, but they differ in what they
receive as input.

A **transformer** receives a value and returns a new value. It
always operates on an input - the resolved result of whatever
reference it is piped from:

```rust
FunctionEntry::transformer("FormatFullName", |value, _args| {
    let (first, last) = (value.get("first").to_js_string(), value.get("last").to_js_string());
    Ok(Value::from(format!("{first} {last}")))
})
```

You use transformers with `.pipe()` on a reference:

```rust
answer("name").pipe([transformer::call("FormatFullName", vec![])])
```

A **generator** produces a value from nothing. It has no input
value - it creates something new based on its arguments alone:

```rust
FunctionEntry::generator("Today", |_args| Ok(JsDate::now().value()))
```

You use generators anywhere a value is expected, without needing
a reference to pipe from:

```rust
govuk::BODY.build(obj! {
    "text": generator::call("Today", vec![]).pipe([transformer::date::format("D MMMM YYYY")]),
})
```

In short: transformers convert an existing value, generators
create a new one.

---

## When do I use a condition vs a conditional?

A **condition** tests a single value and returns true or false.
You use it with `.matches()` on a reference:

```rust
answer("age").matches(condition::number::greater_than(18))
```

This produces a predicate - something that evaluates to true or
false at runtime. Predicates are used in `visibleWhen`,
`validWhen`, `dependentWhen`, and hook `when` guards.

A **conditional** uses a predicate to choose between values.
You use it with `when().then().otherwise()`:

```rust
when(answer("age").matches(condition::number::greater_than(18)))
    .then("Adult")
    .otherwise("Minor")
```

This produces a value - a string, object, or whatever you put in
`then` and `otherwise`. Conditionals are used anywhere a value is
expected: block properties, hook arguments, text content.

The distinction: conditions produce booleans, conditionals
produce values.

---

## What is the difference between data() and answer()?

Both are references that resolve to values at runtime. The
difference is where the value comes from.

**answer()** references a value stored via `context.set_answer()`
or submitted by the user in a form field. Answers are keyed by
field code:

```rust
answer("fullName")    // the user's response to the 'fullName' field
answer("email")       // the user's response to the 'email' field
```

**data()** references a value stored via `context.set_data()` in
an effect. Data is keyed by whatever name you choose:

```rust
data("case")          // loaded by an effect: context.set_data("case", ...)
data("case.status")   // nested path into that data
```

Use `answer()` for user-submitted form values. Use `data()` for
anything loaded from external sources - API responses, reference
data, computed values set in effects.

---

## What is the difference between answer() and post()?

**answer()** references a stored answer - a value that was
submitted on a previous (or current) step and loaded into
context via `context.set_answer()`. It works on both GET and
POST requests because it reads from the evaluation context, not
the request body:

```rust
answer("email")    // the stored answer for the 'email' field
```

**post()** references the raw request body of the current POST
request. It only has a value during form submission - on GET
requests it resolves to undefined:

```rust
post("action")     // the value of an 'action' field in the form body
```

The most common use for `post()` is distinguishing which button
the user pressed when a step has multiple submit actions:

```rust
submit(obj! {
    "when": post("action").matches(condition::equals("delete")),
    "onAlways": obj! {
        "effects": [effect::call("DeleteItem", vec![])],
        "next": [redirect(obj! { "goto": "/items" })],
    },
})
```

Do not use `post()` in places that evaluate on GET requests
(like `visibleWhen`, `next` outcomes evaluated during
reachability, or redirect conditions) - it will always be
undefined there.

---

## How do I get data from an API into my blocks?

Three steps:

1. **Define an effect** that calls the API and stores the result:

```rust
let case_api = services.case_api.clone();
FunctionEntry::effect("LoadCase", move |context, args| {
    let case_api = case_api.clone();
    async move {
        let data = case_api.get_case(&args[0].to_js_string()).await?;
        context.set_data("case", data)
    }
})
```

2. **Call the effect in onAccess** so it runs when the page loads:

```rust
"onAccess": [access(obj! {
    "effects": [effect::call("LoadCase", vec![params("caseId").into()])],
})],
```

3. **Reference the data in your blocks** using `data()`:

```rust
govuk::HEADING.build(obj! { "text": data("case.person.firstName"), "size": "l" })
```

The effect loads the data into context. `data()` creates a
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
`"reachability": obj! { "unreachableRedirect": "frontier" }`.

Common causes:

- **No entry point defined.** At least one step needs
  `"reachability": obj! { "entryWhen": true }` to seed the graph.
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

```rust
"reachability": obj! { "entryWhen": true }
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

```rust
"reachability": obj! {
    "resumeWhen": query("resume").matches(condition::equals("true")),
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
Runjucks, or Topcoat. The `forge-core` crate is framework-agnostic.

The GOV.UK and MOJ component crates
(`forge-govuk-components`, `forge-moj-components`) are optional
registrations that provide pre-built block variants mapped to
those design systems. If you do not register them, Forge will
not use them.

You can build your own components: a `Component` for definitions
and a `ComponentEntry` with a render function for registration,
under your own variants.
The framework adapter handles rendering - if you write a custom
adapter, you can target any templating system.

See [Building custom components](../building-functions-and-components/custom-components)
for the full component authoring guide.

---

## How do I add custom middleware that runs before Forge?

Forge mounts its routes through a framework adapter. In the
Topcoat adapter, `forge_topcoat::mount(builder, forge, renderer, options)`
adds Forge's routes to a Topcoat `RouterBuilder` and returns it. You
build the rest of the router around it like any other:

```rust
let builder = mount(Router::builder(), forge, renderer, options);
let router = add_my_routes(builder).build();
```

Topcoat layers on the router run before Forge handles the request.
This includes authentication, logging, or anything else your
service needs. The adapter manages sessions itself (see
`AdapterOptions::sessions`).

For logic that should run on every step within a journey, use a
journey-level `onAccess` hook instead. Hooks have access to the
Forge evaluation context, which middleware does not.

---

## How can I access data from my middleware?

The Topcoat adapter gives journeys a request state:
`AdapterOptions::state`, merged with whatever your per-request state
function (`AdapterOptions::with_request_state`) returns for the
request, plus the request's `csrfToken` and `cspNonce`. It is
available through the `request::state("key")` reference, and to
effects through `context.get_state("key")`.

Compute per-request values (the signed-in user, feature flags) in
that function. See
[Request & State](/forge-developer-guide/packages/topcoat/request-state).

---

## I'm using answer() in my custom generator/transformer, why isn't it working?

`answer()`, `data()`, and other reference helpers are part of
the definition layer. They produce pointer objects that Forge
resolves during evaluation. Inside a registered function body,
Forge does not process what you write - it just calls your
function and uses the return value.

If you call `answer("name")` inside a transformer, you get back
a definition, not the user's answer:

```rust
// ✗ This does not work
FunctionEntry::transformer("MyTransformer", |value, _args| {
    let name = answer("name"); // a reference definition, not a string
    Ok(Value::from(format!("{:?}: {value}", name.value()))) // the definition's JSON
})
```

Instead, use the value Forge passes into your function, or pass
additional values in as arguments from the definition side:

```rust
// ✓ Transformer: use the value Forge gives you
FunctionEntry::transformer("MyTransformer", |value, _args| {
    Ok(Value::from(format!("{value} - transformed")))
})

// Wire it up in the definition:
answer("name").pipe([transformer::call("MyTransformer", vec![])])
```

```rust
// ✓ Generator: use the arguments Forge resolves for you
FunctionEntry::generator("Greeting", |args| {
    Ok(Value::from(format!("Hello, {}", args[0])))
})

// Pass the reference as an argument in the definition:
generator::call("Greeting", vec![answer("name").into()])
```

See [Definitions and runtime](../building-journeys/definitions-and-runtime)
for a full explanation of the boundary between definition-time
and runtime code.
