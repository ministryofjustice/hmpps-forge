---
title: submit()
slug: submit
section: reference
path: reference/submit
nav: Authoring API/Hooks and outcomes
order: 21
description: Creates a hook that validates, saves, and chooses an outcome for a step submission
teaches: [submit, submit-hooks, validation, effects, outcomes, guards]
prerequisites: [step, field]
related:
  concept: how-validation-works, returning-a-page-redirect-or-error
  reference: access, redirect, throw-error, validation, effect
---

# `submit()`

`submit()` creates a hook that runs on a step `POST`, after Forge has prepared submitted
answers and cleared stale answers.

```typescript
const saveAndContinue = submit({
  validate: true,
  onValid: {
    effects: [ApplicationEffects.SaveContactDetails()],
    next: [redirect({ goto: 'check-answers' })],
  },
})
```

---

## Reference

### `submit(definition)`

Call `submit()` to create a submit hook. Add it to a step's `onSubmission` array.

[See more examples below.](#usage)

```typescript
function submit(definition: Omit<SubmitHook, '_forge'>): SubmitHook
```

#### Parameters

:::param
---
name: definition
type: Omit<SubmitHook, '_forge'>
required: true
---
An object describing when the hook owns a submission, which validation to run, and the
work to perform for each result. Its properties are listed below.
:::

#### Definition properties

:::param
---
name: when
type: PredicateExpr
required: false
---
The condition that selects this hook. When omitted, the hook matches every submission.
When the condition is false, Forge tries the next submit hook in the step's
`onSubmission` array.
:::

:::param
---
name: guards
type: PredicateExpr
required: false
---
An additional condition that must pass after `when`. Use it to prevent the hook running
in request states where the submission is not allowed. When it is false, Forge tries the
next submit hook.
:::

:::param
---
name: validate
type: boolean | { groups: string[] }
required: false
---
Selects [validation](./validation) before Forge chooses `onValid` or `onInvalid`. Set it to `true` to
validate the `default` group, or provide `groups` to validate named groups. When omitted
or `false`, Forge skips validation and uses `onAlways`.
:::

:::param
---
name: groups
parent: validate
type: string[]
required: true
---
The validation groups to run when `validate` is an object.
:::

:::param
---
name: onAlways
type: object
required: false
---
Effects and outcomes to run after `when` and `guards` pass, before validation. This
branch runs whether validation will later pass or fail. A redirect or error outcome here
stops the hook before validation.
:::

:::param
---
name: effects
parent: onAlways
type: EffectFunctionExpr[]
required: false
---
Effects to run in order before this branch evaluates its outcomes.
:::

:::param
---
name: next
parent: onAlways
type: HookOutcome[]
required: false
---
Redirect or error outcomes to evaluate in order. Forge uses the first matching outcome.
:::

:::param
---
name: onValid
type: object
required: false
---
Effects and outcomes to run when the selected validation groups pass. This branch is used
only when `validate` is enabled.
:::

:::param
---
name: effects
parent: onValid
type: EffectFunctionExpr[]
required: false
---
Effects to run in order before this branch evaluates its outcomes.
:::

:::param
---
name: next
parent: onValid
type: HookOutcome[]
required: false
---
Redirect or error outcomes to evaluate in order. Forge uses the first matching outcome.
:::

:::param
---
name: onInvalid
type: object
required: false
---
Effects and outcomes to run when the selected validation groups fail. This branch is used
only when `validate` is enabled.
:::

:::param
---
name: effects
parent: onInvalid
type: EffectFunctionExpr[]
required: false
---
Effects to run in order before this branch evaluates its outcomes.
:::

:::param
---
name: next
parent: onInvalid
type: HookOutcome[]
required: false
---
Redirect or error outcomes to evaluate in order. Forge uses the first matching outcome.
:::

#### Returns

`submit()` returns a submit hook definition ready to add to a step's `onSubmission`
array.

#### Caveats

- Only the first matching submit hook runs. Forge checks `onSubmission` hooks in order.
  Once a hook's `when` and `guards` pass, later hooks do not run, even if the selected
  hook continues without a redirect or error.

- A `POST` does not validate automatically. Forge validates only when the selected submit
  hook sets `validate`. If no hook matches, or the selected hook does not request
  validation, the page can render without submission failures.

- `onAlways` runs before validation. Its effects run even when the selected validation
  would fail, and a redirect or error outcome from `onAlways` stops the hook before
  validation runs.

:::deep-dive
---
title: How Forge chooses one submit path
description: A submitted step can contain several decisions, but Forge picks one submit hook to own the request.
summary: Show submit ordering
---

Submit behaviour has a few layers of ordering.

First, Forge chooses the submit hook. It reads the step's submit hooks from top to bottom.
If a hook's `when` condition or guards do not match the request, Forge skips that hook and
checks the next one.

When a hook does match, that hook owns the submission. Forge does not run later submit
hooks on the same step. This is true even if the matching hook does not redirect and the
page renders again.

Inside the chosen hook, the branch depends on how the hook is authored. An `onAlways`
branch runs without validation. A validating hook runs `onValid` when validation passes,
or `onInvalid` when validation fails.

Inside a branch, effects run before outcomes. That lets the branch do project work before
choosing what happens next.

Finally, the `next` outcomes are also ordered. Forge checks them from top to bottom and
uses the first redirect or error whose `when` condition matches. An unconditional outcome
works well as the final fallback.

That gives authors two useful patterns:

- put button-specific submit hooks first, such as `save-draft`, `cancel`, or
  `find-address`
- put the ordinary continue submit hook last, so it only runs when no more specific action
  matched

The rule prevents a single submission from accidentally running two save paths. A "save
draft" click does not also run the "continue" save. A "find address" action does not also
submit the whole page.

:::

---

## Usage

### Validate, save, and continue

Use a valid branch when a submission should save only after its selected validation rules
pass:

```typescript [[1, 5, "onSubmission: ["], [1, 6, "submit({"], [2, 7, "validate: true"], [3, 8, "onValid: {"], [4, 9, "effects: [ApplicationEffects.SaveContactDetails"], [5, 10, "next: [redirect({ goto: 'check-answers' })]"]]
const contactDetailsStep = step({
  path: '/contact-details',
  title: 'Contact details',
  blocks: [emailAddressField, phoneNumberField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [ApplicationEffects.SaveContactDetails()],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
```

The <s1>submit hook</s1> runs when the step is posted. Forge runs its <s2>validation</s2>
for the `default` group. When it passes, the <s3>valid branch</s3> runs its <s4>effect</s4>
to save the prepared answers, then its <s5>outcome</s5> moves the user to `check-answers`.
When validation fails, the page renders again with the selected failures.

### Choose a submit hook for each action

Put action-specific hooks before the normal continue path:

```typescript [[1, 4, "onSubmission: ["], [1, 5, "submit({"], [3, 7, "onAlways: {"], [4, 8, "effects: [ApplicationEffects.SaveDraft"], [5, 9, "next: [redirect({ goto: 'draft-saved' })]"], [1, 12, "submit({"], [2, 13, "validate: true"], [3, 14, "onValid: {"], [4, 15, "effects: [ApplicationEffects.SaveContactDetails"], [5, 16, "next: [redirect({ goto: 'check-answers' })]"]]
const contactDetailsStep = step({
  path: '/contact-details',
  title: 'Contact details',
  onSubmission: [
    submit({
      when: Post('action').match(Condition.Equals('save-draft')),
      onAlways: {
        effects: [ApplicationEffects.SaveDraft()],
        next: [redirect({ goto: 'draft-saved' })],
      },
    }),
    submit({
      validate: true,
      onValid: {
        effects: [ApplicationEffects.SaveContactDetails()],
        next: [redirect({ goto: 'check-answers' })],
      },
    }),
  ],
})
```

Forge checks <s1>submit hooks</s1> in order. If the submitted action is `save-draft`, the
first hook owns the request and its <s3>always branch</s3> saves the draft before its
<s5>outcome</s5> redirects. Otherwise, the second hook becomes the default path and its
<s2>validation</s2> selects the <s3>valid branch</s3> when it passes.

### Validate named groups

Use named groups when a submission only needs part of the step's validation:

```typescript [[1, 1, "submit({"], [2, 2, "validate: { groups: ['draft'] }"], [3, 3, "onValid: {"]]
submit({
  validate: { groups: ['draft'] },
  onValid: {
    effects: [ApplicationEffects.SaveDraft()],
    next: [redirect({ goto: 'draft-saved' })],
  },
})
```

This <s1>submit hook</s1> runs <s2>validation</s2> only for rules in the `draft` group
before selecting its <s3>valid or invalid branch</s3>. Rules in other groups do not affect
this submission.

---

## Troubleshooting

### A later submit hook does not run

Forge uses the first hook whose `when` and `guards` pass. Once that hook runs, later
hooks on the same step do not run, even if the chosen hook does not redirect. Put
specific actions first and the default hook last.

### Validation errors do not appear after submission

Set `validate` to `true` or choose validation groups. Validation failures are visible
only when the request continues to render; a redirect or error outcome ends the request
instead.

### A save effect runs for invalid input

Effects in `onAlways` run before validation. Move work that must only happen after a
valid submission to `onValid`.
