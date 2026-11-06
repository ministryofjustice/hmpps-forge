---
title: Post
section: authoring-language
path: authoring-language/post
teaches: [post, post-body, form-submission-data]
prerequisites: [step, StepDefinition, onSubmission, submit]
---

<p class="govuk-caption-xl">References</p>

# Post

`post()` references values from the request body on form submission.
Its most common use is distinguishing which button the user pressed
when a step has more than one.

{{slot:toc}}

---

## What is Post?

When a form is submitted, every named input in the form is sent in
the request body. `post()` creates a reference to these values by
name. `post()` gives you access to the raw submitted values,
including ones that are not declared as fields in your step
definition, like button names and hidden inputs.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

post("action")
```

The primary use case is matching buttons. When a step has multiple
submit buttons, each one sends a different value, and hooks use
`post()` to determine which was pressed:

```rust
govuk::BUTTON.build(obj! { "text": "Save and continue", "name": "action", "value": "continue" })
govuk::BUTTON.build(obj! { "text": "Save as draft", "name": "action", "value": "saveDraft" })
```

```rust
"onSubmission": [
    submit(obj! {
        "when": post("action").matches(condition::equals("continue")),
        "validate": true,
        "onValid": obj! {
            "effects": [effect::call("SaveAnswers", vec![])],
            "next": [redirect(obj! { "goto": "next-step" })],
        },
    }),
    submit(obj! {
        "when": post("action").matches(condition::equals("saveDraft")),
        "onAlways": obj! {
            "effects": [effect::call("SaveDraft", vec![])],
            "next": [redirect(obj! { "goto": "/dashboard" })],
        },
    }),
],
```

---

## How it works

When Forge evaluates `post("action")`, it reads the value from the
parsed request body. On GET requests, there is no body, so `post()`
references resolve to `undefined`. This makes `post()` only
meaningful in `onSubmission` hooks, which run on POST
requests.

The framework adapter parses the request body and makes values
available as strings, or arrays of strings for repeated names.

In effect functions, the same values are available through
`context.get_post_data(key)`:

```rust
FunctionEntry::effect("RemoveItem", move |context, _args| {
    let store = store.clone();
    async move {
        let Some(action) = context.get_post_data("action").as_str().map(str::to_owned) else {
            return Ok(());
        };

        let index: usize = action.trim_start_matches("remove_").parse().unwrap_or_default();
        store.remove_item(&context.get_session().get("id"), index).await
    }
})
```

Use `context.get_all_post_data()` when an effect needs the whole
POST body as an object:

```rust
let post_data = context.get_all_post_data();
```

---

## Using in your definitions

### Multiple submit buttons

The most common pattern. Each button shares the same `name` but has
a different `value`, and hooks match on it:

```rust
govuk::BUTTON.build(obj! { "text": "Add steps", "name": "action", "value": "addSteps" })
govuk::BUTTON.build(obj! {
    "text": "Save without steps",
    "name": "action",
    "value": "saveWithoutSteps",
})
```

```rust
"onSubmission": [
    submit(obj! {
        "when": post("action").matches(condition::equals("addSteps")),
        "validate": true,
        "onValid": obj! {
            "effects": [effect::call("CreateGoal", vec![])],
            "next": [redirect(obj! { "goto": format("../%1/add-steps", [data("goalUuid").into()]) })],
        },
    }),
    submit(obj! {
        "when": post("action").matches(condition::equals("saveWithoutSteps")),
        "validate": true,
        "onValid": obj! {
            "effects": [effect::call("CreateGoal", vec![])],
            "next": [redirect(obj! { "goto": "../../plan/overview" })],
        },
    }),
],
```

### In-page actions

Non-validating submit hooks use `post()` the same way. A secondary
button might trigger a lookup without leaving the page:

```rust
submit(obj! {
    "when": post("action").matches(condition::equals("lookup")),
    "validate": false,
    "onAlways": obj! {
        "effects": [effect::call("LookupPostcode", vec![post("postcode").into()])],
    },
})
```

Here `post()` serves double duty: matching which button was pressed
and passing a submitted value into the effect.

### Pattern matching on button values

When buttons encode information in their values, string conditions
can extract meaning without parsing:

```rust
submit(obj! {
    "when": post("action").matches(condition::string::starts_with("remove_")),
    "validate": false,
    "onAlways": obj! {
        "effects": [effect::call("RemoveItem", vec![])],
    },
})
```

This matches any button whose value starts with `remove_`, such as
`remove_0`, `remove_1`, and so on. The effect can read the full
value from `context.get_post_data("action")` to determine
which item to remove.

---

## API surface

### `post(key)`

Creates a reference to a value in the request body.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

`key` is a string matching the `name` attribute of a form input.
Supports dot notation for nested access.

Returns a chainable reference that supports `.path()`, `.matches()`,
`.pipe()`, and `.each()`.

---

## Best practices

- **Keep `post()` in hooks, not blocks.** `post()` is only
  meaningful on POST requests. Using it in block properties like
  `visibleWhen` will resolve to `undefined` on the initial GET
  render.
- **Do not use `post()` in redirect conditions.** Redirects can
  run during traversal checks on GET requests, where there is no
  POST body. Use `answer()` or `data()` for redirect conditions
  instead.
- **Mark `post()`-based validations as `submissionOnly`.** If a
  validation rule depends on a `post()` value, set
  `"submissionOnly": true` so it is skipped during traversal checks,
  where the POST body is not available.
