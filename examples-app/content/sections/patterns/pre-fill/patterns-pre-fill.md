---
title: Pre-fill from an external system
section: patterns
path: patterns/pre-fill
teaches: [pre-fill, onSubmission, validation-groups, setAnswer]
prerequisites: [step, effects, answers]
---

<p class="govuk-caption-xl">Patterns</p>

# Pre-fill from an external system
A form page that calls an external API mid-journey and populates
fields with the response, letting the user review or edit the
values before continuing.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/pre-fill" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Reach for this pattern when a form needs data that exists in
another system and you want the user to confirm or adjust it
rather than type it from scratch.

It fits well when:

- An external API can supply some or all of the field values.
- The user should see and be able to edit the pre-filled values
  before submission.
- The lookup requires a user-provided input first (such as a
  postcode, reference number, or search term).

It does not fit when the data should load automatically without
user input. In that case, use the
[load reference data on access](load-reference-data) pattern,
which runs an access hook before the page renders.

---

## What the pattern covers

The live demo implements a "Find address" flow. Following it
shows:

- **A grouped submit hook** that validates only the lookup input
  before calling the external API.
- **An effect that calls an external API** and writes the response
  into form field answers using `set_answer()`.
- **Pre-filled form fields** that the user can review and edit
  before continuing.
- **Separation of concerns** between the lookup validation group
  and the main form submission.

---

## Anatomy of the flow

```
/forge-developer-guide/patterns/demos/pre-fill/
├── /overview           → Overview and "See the demo" button
├── /find-address       → Postcode input + Find address + address fields
├── /check-answers      → Summary of the address
└── /confirmation       → Submission panel
```

The find-address step is the core of this pattern. It has a
postcode input and a "Find address" button that triggers a submit
hook for the `find-postcode` validation group. When that group is
valid, the hook calls the API and the effect populates the address
fields. The page re-renders with the pre-filled values, and the
user can edit them before pressing "Continue".

---

## How it works

### The lookup submit hook

The step registers a submit hook that fires when the user presses
the "Find address" button. The button posts with
`action=find-address`, and the hook validates only the
`find-postcode` group before running the lookup effect:

```rust
"onSubmission": [
    submit(obj! {
        "when": post("action").matches(condition::equals("find-address")),
        "validate": obj! { "groups": ["find-postcode"] },
        "onValid": obj! {
            "effects": [effect::call("LookupAddress", vec![])],
        },
    }),
],
```

The lookup hook has no redirect, so a valid lookup re-renders the
same page. The effect's `set_answer()` calls populate the fields
before the re-render, so the user sees the pre-filled values
immediately. If the lookup postcode is blank or badly formatted,
Forge renders validation errors for that group without validating
the address fields.

### The effect implementation

The effect reads the postcode from the form context, calls the
injected API client, and writes each field of the response as an
answer:

```rust
FunctionEntry::effect("LookupAddress", move |context, _args| {
    let mocks_api = mocks_api.clone();
    async move {
        let postcode = context.get_answer("postcode");

        if !postcode.truthy() {
            return Ok(());
        }

        let address = mocks_api.lookup_address(&postcode.to_js_string()).await?;

        context.set_answer("addressLine1", address.line1.into())?;
        context.set_answer("addressLine2", address.line2.into())?;
        context.set_answer("addressTown", address.town.into())?;
        context.set_answer("addressCounty", address.county.into())?;
        context.set_answer("addressPostcode", address.postcode.into())
    }
})
```

The demo uses a `MocksApi` class that returns canned addresses,
but the pattern is the same for any external data source. The API
client is injected as a dependency when the package is registered,
so the effect never imports services directly.

### The "Find address" button

The button is a standard `govuk::BUTTON` with `name` and `value`
set so the POST data triggers the lookup submit hook. It uses the
`govuk-button--secondary` class to distinguish it from the
primary "Continue" button:

```rust
let find_address_button = govuk::BUTTON.build(obj! {
    "text": "Find address",
    "name": "action",
    "value": "find-address",
    "classes": "govuk-button--secondary",
});
```

### Separating lookup from submission

The step has two buttons that post different `action` values. The
"Find address" hook validates only `find-postcode`, while the
"Continue" hook validates only `address` and redirects:

```rust
"onSubmission": [
    submit(obj! {
        "when": post("action").matches(condition::equals("find-address")),
        "validate": obj! { "groups": ["find-postcode"] },
        "onValid": obj! {
            "effects": [effect::call("LookupAddress", vec![])],
        },
    }),
    submit(obj! {
        "when": post("action").matches(condition::equals("continue")),
        "validate": obj! { "groups": ["address"] },
        "onValid": obj! {
            "effects": [effect::call("SaveDraftAnswers", vec!["pre-fill".into()])],
            "next": [redirect(obj! { "goto": "check-answers" })],
        },
    }),
],
```

When the user presses "Find address", Forge validates the lookup
postcode and re-renders with populated fields if it is valid. When
they press "Continue", Forge validates the address fields and
navigates to check-your-answers.

---

## Variations

- **Select from multiple results.** When the API returns several
  matches, present them in a `GovUKSelect` dropdown before
  populating the fields. One grouped submit hook sets the options
  as data, and a second grouped submit hook applies the selected
  one.
- **Progressive disclosure.** Hide the address fields until the
  lookup returns results. Use a `visibleWhen` condition that
  checks whether the first address field has a value.
- **Error handling.** When the API call fails, use
  `context.set_data()` to surface an error message through an
  `InsetText` or `ErrorSummary` block, rather than throwing.
- **Clearing pre-filled values.** Add a "Clear" button as another
  submit intent that resets the address fields, letting the user
  enter an address manually.
