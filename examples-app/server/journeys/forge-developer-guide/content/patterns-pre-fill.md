---
title: Pre-fill from an external system
section: patterns
path: patterns/pre-fill
teaches: [pre-fill, action-hook, onAction, setAnswer]
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

- **An action hook** that runs on a button press without leaving
  the page.
- **An effect that calls an external API** and writes the response
  into form field answers using `setAnswer()`.
- **Pre-filled form fields** that the user can review and edit
  before continuing.
- **Separation of concerns** between the lookup trigger
  (`onAction`) and the main form submission (`onSubmission`).

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
postcode input and a "Find address" button that triggers an action
hook. The hook calls the API, and the effect populates the address
fields. The page re-renders with the pre-filled values, and the
user can edit them before pressing "Continue".

---

## How it works

### The action hook

The step registers an `onAction` hook that fires when the user
presses the "Find address" button. The button posts with
`action=find-address`, and the hook's `when` condition matches
that value:

```typescript
onAction: [
  action({
    when: Post('action').match(Condition.Equals('find-address')),
    effects: [PatternEffects.LookupAddress()],
  }),
],
```

Action hooks run after the POST data is parsed but before
validation and submit hooks. Because no submit hook matches the
`find-address` action, the page re-renders instead of
redirecting. The effect's `setAnswer()` calls populate the fields
before the re-render, so the user sees the pre-filled values
immediately.

### The effect implementation

The effect reads the postcode from the form context, calls the
injected API client, and writes each field of the response as an
answer:

```typescript
LookupAddress: (deps) => async (context) => {
  const postcode = context.getAnswer('postcode')

  if (!postcode) {
    return
  }

  const address = await deps.mocksApi.lookupAddress(postcode)

  context.setAnswer('addressLine1', address.line1)
  context.setAnswer('addressLine2', address.line2)
  context.setAnswer('addressTown', address.town)
  context.setAnswer('addressCounty', address.county)
  context.setAnswer('addressPostcode', address.postcode)
}
```

The demo uses a `MocksApi` class that returns canned addresses,
but the pattern is the same for any external data source. The API
client is injected as a dependency when the package is registered,
so the effect never imports services directly.

### The "Find address" button

The button is a standard `GovUKButton` with `name` and `value`
set so the POST data triggers the action hook. It uses the
`govuk-button--secondary` class to distinguish it from the
primary "Continue" button:

```typescript
export const findAddressButton = GovUKButton({
  text: 'Find address',
  name: 'action',
  value: 'find-address',
  classes: 'govuk-button--secondary',
})
```

### Separating lookup from submission

The step has two buttons that post different `action` values. Only
the "Continue" button triggers the submit hook, which validates
and redirects:

```typescript
onSubmission: [
  submit({
    when: Post('action').match(Condition.Equals('continue')),
    validate: true,
    onValid: {
      effects: [PatternEffects.SaveDraftAnswers('pre-fill')],
      next: [redirect({ goto: 'check-answers' })],
    },
  }),
],
```

When the user presses "Find address", the action hook runs but no
submit hook matches, so the page re-renders with the populated
fields. When they press "Continue", the submit hook validates
the address fields and navigates to check-your-answers.

---

## Variations

- **Select from multiple results.** When the API returns several
  matches, present them in a `GovUKSelect` dropdown before
  populating the fields. The action hook sets the options as data,
  and a second action hook applies the selected one.
- **Progressive disclosure.** Hide the address fields until the
  lookup returns results. Use a `visibleWhen` condition that
  checks whether the first address field has a value.
- **Error handling.** When the API call fails, use
  `context.setData()` to surface an error message through an
  `InsetText` or `ErrorSummary` block, rather than throwing.
- **Clearing pre-filled values.** Add a "Clear" button as another
  action that resets the address fields, letting the user enter an
  address manually.
