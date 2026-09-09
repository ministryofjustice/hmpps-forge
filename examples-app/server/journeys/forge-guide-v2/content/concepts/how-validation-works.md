---
title: How validation works
slug: how-validation-works
section: concepts
path: concepts/how-validation-works
nav: Validation and journey progress
order: 13
description:
  How validation rules describe valid state, and how Forge decides when errors
  become visible
teaches:
  [
    validation,
    field-validation,
    step-validation,
    conditions,
    messages,
    domain-rules,
    validation-timing,
    entry-validation,
    submit-validation,
    validation-groups,
    submission-only-rules,
  ]
prerequisites:
  [
    how-answers-work,
    how-expressions-work,
    how-forge-runs-a-request,
  ]
related:
  concept:
    [
      how-forge-decides-where-users-can-go,
      how-expressions-work,
      how-blocks-resolution-and-rendering-connect,
    ]
  reference: [validation]
---

# How validation works

Forge can know that something is invalid without showing an error to the user.

That distinction matters in form journeys. A journey needs to know whether a step is
complete so it can protect progress. But showing every possible error as soon as a user
opens a page is abrupt, especially when the user has not tried to continue yet.

Forge separates validation from validation display. The same rules answer two different
questions: "how far can the user go?" and "did this page pass?"

## A rule says when something is valid

A validation rule describes valid state.

```ts
validation({
  condition: Self().match(Condition.IsRequired()),
  message: "Enter an email address",
});
```

This rule says the current field is valid when it has a value.

That positive shape keeps the rule aligned with reachability and submit behaviour. Forge
can ask "is this valid?" and use the answer consistently, whether or not the user will see
an error message on this request.

## Rules live where the error belongs

Field validation carries rules about a single field's answer.

```ts
GovUKTextInput({
  code: "emailAddress",
  label: "Email address",
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: "Enter an email address",
    }),
    validation({
      condition: Self().match(Condition.Email.IsValidEmail()),
      message: "Enter an email address in the correct format",
    }),
  ],
});
```

The rule sits with the field because the error belongs with that field. When errors are
visible, Forge attaches the failure to the rendered field block.

Some rules are about the page, not a single field. Two answers need to agree, a date range
needs its end date after its start date, or a list needs at least one item. Those rules live on the step.

```ts
step({
  path: "dates",
  title: "Dates",
  validWhen: [
    validation({
      condition: Answer("endDate").match(Condition.Date.IsAfter(Answer("startDate"))),
      message: "The end date must be after the start date",
    }),
  ],
  blocks: [startDateField, endDateField],
});
```

Step validation gives the rule a page-level home instead of pretending that one field owns
a relationship that depends on several values.

Error placement matches how the user can recover. A field rule points the user at one
field to edit, while a step rule points at a relationship across the page where no single
field owns the problem.

## Validation can read the current request

Validation conditions are expressions that can read answers, loaded data, params, query
values, session values, and other request state.

```ts
validation({
  condition: Answer("selectedOffice").match(
    Condition.Array.IsIn(Data("availableOfficeCodes")),
  ),
  message: "Select an available office",
});
```

Validation stays declarative even when the valid set comes from loaded data.

The boundary of validation is the question "is this answer acceptable?" Saving data,
calling an API, and writing an audit event are not answers to that question. They are
effects, and they run from hooks.

## Forge validates in two rounds

This is the core of the model. Forge runs one rule-execution machine under two different
filters, with two separate result stores.

**The reachability round** validates every step, once per request, under a fixed filter:
default group only, no `submissionOnly` rules. Results go into a navigation validity map
that the reachability walk reads. This round never touches validation display.

**The current-page round** validates only the page handling the request. It runs under the
filter the author chose: the groups from `validateOnEntry` or `validate` on the submit
hook. Its result is stored as `currentPageValidation`, and the presence of that result is
the display signal. Present means it ran and errors are visible (even if it passed with no
failures). Absent means it never ran, and no errors appear.

Reachability validation protects the path. Current-page validation helps the user fix the
page.

:::deep-dive
---
title: What the reachability round does with validity
description: How invalid steps stay reachable themselves but stop later steps from being reached, and why the current step is included.
summary: Show how validity feeds navigation
---

The reachability walk propagates forward through the graph. When it reaches a step, it
marks that step as reachable and then checks whether the step is valid. A valid step lets
the walk continue to its successors, while an invalid step stops the walk there.

This means a reachable step can still be invalid. The user needs to reach it to fix it.
What validation prevents is skipping beyond work that is not complete.

The reachability round includes the current step. Resume and frontier resolution need its
navigation validity, and this round runs before either current-page trigger runs. The
result is a navigation fact only, not a display decision.

:::

## POST: submission makes validation visible

On a `POST`, a submit hook decides whether validation runs.

```ts
submit({
  validate: true,
  onValid: {
    next: [redirect({ goto: "check-answers" })],
  },
});
```

With `validate: true`, Forge validates the default group. With named groups, it validates
the groups the submit hook asks for. In both cases, `submissionOnly` rules are included.

The submit lifecycle runs in a fixed order: `when`, guards, `onAlways`, validation,
`onValid`/`onInvalid`. Validation runs after `onAlways` because `onAlways` transforms data
that validation depends on.

If validation fails and no `onInvalid` outcome halts the request (redirect or error), the
pipeline continues to render the page. Forge has the failures it needs to attach errors to
fields and to the page. This is the familiar "submit and show errors" behaviour.

If validation passes, the `onValid` path runs.

## GET: entry validation opts a page into visibility

A plain `GET` renders the page without showing errors.

When a user opens a task from a task list, follows a resume link, or lands on a page with
saved invalid answers, the page needs to show what requires attention.

`validateOnEntry` controls which validation groups are visible when the page opens.

```ts
step({
  path: "contact-details",
  title: "Contact details",
  validateOnEntry: [
    {
      groups: ["contact"],
      when: Answer("contactStarted").match(Condition.Equals(true)),
    },
  ],
});
```

The page can still be invalid without errors being visible. `validateOnEntry` is the
author's decision that says "on this kind of entry, showing the errors is useful."

Entry validation never includes `submissionOnly` rules. Rules marked `submissionOnly` stay
quiet until the user submits.

## Groups and `submissionOnly` choose the moment

A page can need different validation at different moments.

A draft save action only requires the answer shape to be acceptable, a continue action
requires all mandatory fields, and a final confirmation adds a declaration on top.
Validation groups let the step define those sets without duplicating the page.

```ts
validation({
  groups: ["continue"],
  condition: Self().match(Condition.IsRequired()),
  message: "Enter the reference number",
});
```

Then the submit behaviour chooses the group for the action the user took. A group names a
journey moment, not a presentation detail. That is why group names like `continue`,
`draft`, or `final-check` read as actions the user takes.

Only rules in the default group participate in reachability. Entry validation runs the
groups selected by matching `validateOnEntry` rules, including non-default groups.
`submissionOnly` rules never run in the reachability round or in
entry validation, regardless of their group. This keeps progress fair: a user can reach
the confirmation page, and the `submissionOnly` rule becomes visible only when they submit
it.

:::deep-dive
---
title: How groups and submissionOnly filter into each round
description: A summary of which rules run in each of the two validation rounds, and what controls the selection.
summary: Show the filtering rules
---

Every validation run passes a filter with two parts: a list of groups and whether to
include `submissionOnly` rules. The compiled validation function skips rules outside the
active groups and `submissionOnly` rules (unless included) before evaluating any condition.

| Round | Groups | Includes `submissionOnly` |
|---|---|---|
| Reachability | `['default']` | No |
| Entry (GET) | Groups from matching `validateOnEntry` | No |
| Submit (POST) | Groups from the submit hook's `validate` | Yes |

A rule with `groups: ['continue']` never gates reachability, which requests the default
group. It runs during entry validation when a matching `validateOnEntry` rule selects
`'continue'`. A rule with `submissionOnly: true` and
`groups: ['default']` runs in the reachability and entry filtering window but is excluded
by the `submissionOnly` flag in those rounds. It runs only on submission.

:::

## Messages help the user recover

A validation message explains what the user needs to change. A message that names the
missing or invalid thing gives the user their next action:

```ts
message: "Enter a National Insurance number";
```

A message that only describes failure leaves the user to work it out:

```ts
message: "Invalid value";
```

The rule can be abstract. The message is concrete.

Concrete messages are especially important for step validation errors. Step errors attach
to the page rather than to one field, so the user needs to know which part of the page
needs attention, even when the rule compares several answers.

## Validation is separate from effects

Effects can call services, save data, set cookies, or choose outcomes. Validation describes
valid state.

That separation is what lets the same rules serve both rounds. A submit hook can ask Forge
to validate and then choose what to do. The validation rules stay focused on whether the
answers are acceptable. Effects act on the result.
