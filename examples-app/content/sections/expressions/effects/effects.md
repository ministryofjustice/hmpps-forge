---
title: Effects
section: authoring-language
path: authoring-language/effects
teaches: [effects, effect-references-in-hooks, effect-arguments]
prerequisites: [onAccess, onSubmission, access, submit, data, answer]
---

<p class="govuk-caption-xl">Functions</p>

# Effects

Effects are where your application logic lives. They run inside
hooks and are the bridge between Forge's declarative definitions
and the outside world: loading data from APIs, saving answers to a
data store, sending audit events, or anything else your service
needs. Forge orchestrates when they run; your implementations decide
what they do.

{{slot:toc}}

---

## What is an effect?

Conditions, transformers, and generators are all pure functions.
They take a value and return a result without touching anything
outside the expression system. Effects are different. They can read
and write answers, set data for the current request, access the
session, and call external services.

Effects do not appear in block properties. They only appear inside
hooks, listed in the `effects` array:

```rust
"onAccess": [
    access(obj! {
        "effects": [effect::call("LoadCaseData", vec![params("caseId").into()])],
    }),
],
```

Multiple effects in the same array run in sequence. Each one
completes before the next starts.

---

## How it works

### Arguments from the definition

Effects can accept arguments. The values in the definition can be
static or expressions, and Forge resolves them before calling the
effect:

```rust
// Static argument
"effects": [effect::call("LoadCaseData", vec!["123".into()])],
// Dynamic argument
"effects": [effect::call("LoadCaseData", vec![params("caseId").into()])],
```

When the hook runs, `params("caseId")` is resolved to the actual
value from the URL, then passed to the effect.

### What effects can do

Effects have access to a context object that exposes the current
request's state. Through this context they can:

- **Read and write answers** – `context.get_answer(code)`,
  `context.set_answer(code, value)`, `context.has_answer(code)`,
  `context.get_all_answers()`.
- **Set data for the current request** – `context.set_data(key, value)`
  makes a value available through `data(key)` for the rest of the
  request.
- **Read request information** – `context.get_request_param(key)`,
  `context.get_query_param(key)`, `context.get_post_data(key)`,
  `context.get_all_post_data()`, `context.get_session()`.
- **Inspect reachability** – `context.get_fields_to_clear()` returns
  answer keys from steps that are no longer reachable.

From the authoring side, you usually do not need to know the exact
method names. The effect hides that detail behind a named operation
like `LoadCaseData` or `SaveAnswers`. The names in this list are
useful when you are reading or writing effect implementations.

---

## Using in your definitions

Effects are referenced in hooks using the effect builders produced
by the package that defines them:

```rust
// Access hook: load data before the page renders
"onAccess": [
    access(obj! {
        "effects": [effect::call("LoadCaseData", vec![params("caseId").into()])],
    }),
],
// Submit hook: handle an in-page lookup
"onSubmission": [
    submit(obj! {
        "when": post("action").matches(condition::equals("lookup")),
        "validate": false,
        "onAlways": obj! {
            "effects": [effect::call("LookupPostcode", vec![post("postcode").into()])],
        },
    }),
],
// Submit hook: save on valid submission
"onSubmission": [
    submit(obj! {
        "validate": true,
        "onValid": obj! {
            "effects": [effect::call("SaveAnswers", vec![])],
            "next": [redirect(obj! { "goto": "next-step" })],
        },
    }),
],
```

Effects can be combined freely. A load-then-save pattern in a submit
hook might look like this:

```rust
submit(obj! {
    "validate": true,
    "onValid": obj! {
        "effects": [
            effect::call("SaveAnswers", vec![]),
            effect::call("SendConfirmationEmail", vec![]),
        ],
        "next": [redirect(obj! { "goto": "confirmation" })],
    },
})
```

---

## Custom effects

Every effect in a journey is custom. Forge does not ship a built-in
library of effects because the work they do is application-specific:
which API to call, which data store to write to, which audit events
to send. You define the effects your application needs and register
them in its package.

See [Building custom effects](../building-functions-and-components/custom-effects)
for the shape interface, implementation, context API, typed
contexts, and registration details.

---

## Best practices

- **Keep effects focused.** Each effect should do one thing: load
  data, save answers, call an API. Compose multiple effects in a
  hook's `effects` array rather than building one large effect that
  does everything.
- **Pass dynamic values as arguments.** When an effect needs a value
  from the request, pass it through the definition as an expression
  (`params("caseId")`, `answer("reference")`). This keeps the effect
  reusable across callers.
- **Use `data()` for values blocks need.** Data set by an effect is
  available through `data()` references for the rest of the request,
  so blocks can declare what they need without knowing where it came
  from.
