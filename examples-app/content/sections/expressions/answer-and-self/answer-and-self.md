---
title: Answer and Self
section: authoring-language
path: authoring-language/answer-and-self
teaches: [answer, self_, field-reference, answer-reference]
prerequisites: [field, FieldBlockDefinition, code]
---

<p class="govuk-caption-xl">References</p>

# Answer and Self

Most properties in a Forge definition are static: a label's text, a
button's classes, a step's title. But some need to react to what the
user has entered. `answer()` and `self_()` are how you bring user
input into your definitions, turning static properties into dynamic
ones.

{{slot:toc}}

---

## What are Answer and Self?

### Answer

Every field has a `code` that identifies its stored answer. When a
user fills in a text input with `"code": "fullName"`, their response
is stored under that code. `answer("fullName")` creates a reference
to that stored value.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

answer("fullName")
```

Alternatively, you can pass a field definition object directly.
`answer(email_field)` extracts the `code`from the object and produces the
same reference as `answer("email")`. This keeps the reference coupled
to the field, so renaming the code in one place updates both.

### Self

`self_()` references the current field's own answer. It's partly
convenience, saving you from repeating the field's code in every
rule, and partly about keeping references intact. Validation rules
that use `self_()` do not need to know the field's code.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

self_()
```

Without `self_()`, validation rules would need
`answer("fullName").matches(...)`, coupling each rule to the field's
code. Rename the field or extract the rules into a shared validation
array, and they break. `self_()` resolves to whichever field it
belongs to, so the rules stay portable.

> `self_()` can only be used inside a field definition. Using it
> outside one produces a compile-time error.

---

## How it works

Both `answer()` and `self_()` create reference expressions that Forge
resolves during evaluation. When Forge encounters
`answer("fullName")`, it looks up `"fullName"` in the current set of
stored answers. If the user has entered a value, the expression
resolves to it. If not, it resolves to `undefined`.

`self_()` works the same way, but Forge fills in the field code
automatically. At compile time, it replaces `self_()` with a
reference to the containing field's code. At runtime it resolves
exactly as the equivalent `answer()` call would.

Forge is stateless, so answers are only available if your effects
store and load them. A typical pattern is saving answers on
submission and restoring them on access:

```rust
// In a submit hook effect
FunctionEntry::effect("SaveAnswers", move |context, _args| {
    let store = store.clone();
    async move {
        let answers = context.get_all_answers();
        store.save(&context.get_session().get("id"), answers).await
    }
})

// In an access hook effect
FunctionEntry::effect("LoadAnswers", move |context, _args| {
    let store = store.clone();
    async move {
        let answers = store.load(&context.get_session().get("id")).await?;
        for (code, value) in answers {
            context.set_answer(&code, value)?;
        }
        Ok(())
    }
})
```

See [Loading, saving and redirecting](../building-journeys/loading-saving-and-redirecting)
for common patterns.

---

## Using in your definitions

### Using Answer

Use `answer()` to display values the user entered on earlier pages:

```rust
govuk::SUMMARY_LIST.build(obj! {
    "rows": [
        obj! {
            "key": obj! { "text": "Name" },
            "value": obj! { "text": answer("fullName") },
            "actions": obj! {
                "items": [obj! { "href": "name", "text": "Change", "visuallyHiddenText": "name" }],
            },
        },
    ],
})
```

The same reference works in conditions. Show or hide a field based
on a previous answer, or branch to different steps after submission:

```rust
// Show a field only when the user selected 'phone'
govuk::TEXT_INPUT.build(obj! {
    "code": "phoneNumber",
    "label": obj! { "text": "Phone number" },
    "visibleWhen": answer("appointmentType").matches(condition::equals("phone")),
    "dependentWhen": answer("appointmentType").matches(condition::equals("phone")),
})
```

```rust
// Route to different steps based on the answer
"onSubmission": [
    submit(obj! {
        "validate": true,
        "onValid": obj! {
            "next": [
                redirect(obj! {
                    "when": answer("appointmentType").matches(condition::equals("in-person")),
                    "goto": "location",
                }),
                redirect(obj! { "goto": "choose-date" }),
            ],
        },
    }),
],
```

Because `answer()` is just data, it composes freely with other
expressions. A confirmation page might combine `answer()` with
`format()` for interpolation, `match_()` for conditional text, and
`.pipe()` for value transformation, all in a single block definition:

```rust
govuk::PANEL.build(obj! {
    "titleText": "Appointment booked",
    "html": format("Your %1 appointment has been booked for %2 at %3.", [match_(answer("appointmentType")).branch(condition::equals("in-person"), "in-person").branch(condition::equals("phone"), "phone").branch(condition::equals("video"), "video call").otherwise("").build(), answer("appointmentDate").pipe([transformer::string::to_date(), transformer::date::format("D MMMM YYYY")]).into(), answer("appointmentTime").into()]),
})
```

Forge evaluates every expression in the block before passing it to
the component. The component receives concrete values, not
expressions. It never needs to know that the panel body was
assembled from three different field answers.

### Using Self

`self_()` is most commonly used in `validWhen` rules. Because it
resolves to whatever field it sits inside, validation rules stay
portable:

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "fullName",
    "label": obj! { "text": "Full name" },
    "formatters": [transformer::string::trim()],
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter your full name",
        }),
        validation(obj! {
            "condition": self_().matches(condition::string::has_max_length(200)),
            "message": "Full name must be 200 characters or less",
        }),
    ],
})
```

Cross-field validation is where `self_()` and `answer()` work side by
side. `self_()` references the field being validated, `answer()`
references the field it's compared against:

```rust
govuk::DATE_INPUT_FULL.build(obj! {
    "code": "tripReturnDate",
    "fieldset": obj! {
        "legend": obj! { "text": "When did you return to the UK?" },
    },
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::date::is_after(answer("tripDepartureDate"))),
            "message": "Return date must be after the departure date",
        }),
    ],
})
```

---

## Nested values

`answer()` supports dot notation for reaching into nested values. If
a field stores an object, you can reference individual properties:

```rust
answer("address.postcode")
```

Forge splits the string on dots and walks the resulting path, so
`answer("address.postcode")` is equivalent to
`answer("address").path("postcode")`. The `.path()` method is
available on both `answer()` and `self_()` and can be chained:

```rust
answer("user").path("address").path("city")
```

For static paths, dot notation in the argument reads more naturally.
`.path()` is more useful when building paths across multiple steps.

---

## API surface

### `answer(target)`

Creates a reference to a field's stored answer.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

`target` can be a string code (`answer("email")`), a string with dot
notation (`answer("address.postcode")`), or a field definition object
(`answer(email_field)`).

Returns a chainable reference that supports `.path()`, `.matches()`,
`.pipe()`, and `.each()`.

### `self_()`

Creates a reference to the containing field's own answer. Takes no
arguments.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

Returns the same chainable reference type as `answer()`. Must be
used inside a field definition.

### `.path(key)`

Navigates to a nested property within the referenced value. Supports
dot notation and can be chained.

```rust
answer("address").path("postcode")
self_().path("day")
```

---

## Best practices

- **Use `self_()` in validation rules.** It decouples the rule from
  the field's code, so validation arrays can be extracted and reused
  across fields without modification.
- **Use `answer()` for everything else.** Displaying values,
  conditional rendering, routing, cross-field validation: any time
  you need another field's answer.
- **Prefer string codes for simplicity.** The string form works
  across file boundaries without imports. Use the field definition
  form when you want the reference tightly coupled to the field
  object.
- **Use dot notation in the argument for static paths.**
  `answer("address.postcode")` reads more naturally than
  `answer("address").path("postcode")`.
