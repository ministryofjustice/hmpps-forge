---
title: Single question per page
section: patterns
path: patterns/single-question-per-page
teaches: [single-question-per-page, check-answers]
prerequisites: [step, submit, validation]
---

<p class="govuk-caption-xl">Patterns</p>

# Single question per page
A sequential flow that asks one question per page, validates each
submission, and shows a check-your-answers summary before
confirmation.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/single-question-per-page" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Reach for this pattern when a task is best broken into small, focused
questions and the answers can be validated independently. The
GOV.UK Design System
[recommends asking one thing per page](https://design-system.service.gov.uk/patterns/question-pages/)
for accessibility, reduced cognitive load, and simpler error handling.

It fits well when:

- Each question has its own validation rules.
- The answers are independent enough that users can leave and return.
- A check-your-answers page gives a useful final review before
  submission.

It does not fit as well when questions are tightly coupled (for
example, a date range where both ends must be set together). In those
cases, a grouped page keeps the two fields next to each other.

---

## What the pattern covers

The live demo works end-to-end. Following the flow shows:

- **Single-field steps** with the label promoted to the page heading.
- **Validation** on each submission, with inline errors and an error
  summary at the top of the page.
- **Answer persistence** between steps. The demo stores answers in
  the express session so they survive navigation and reloads.
- **Check your answers** with change links that send the user back to
  the original step, then return them to the summary after saving.
- **Confirmation** on a final panel, with a reset that clears the
  session-stored answers.

---

## Anatomy of the flow

```
/forge-developer-guide/patterns/demos/single-question-per-page/
├── /                 → Overview and "Start" button
├── /your-name        → Field: fullName
├── /your-role        → Field: role
├── /check-answers    → Summary list with change links
└── /confirmation     → Panel and restart
```

Each question step redirects to the next on valid submission. The
check-answers step saves once more and redirects to the confirmation.
The confirmation step clears the saved answers on access so "Restart
pattern" always starts from a blank slate.

---

## How it works

### Answer persistence

The pattern journey registers a single access hook at the journey
level:

```typescript
onAccess: [
  access({
    effects: [PatternEffects.LoadAnswers('single-question-per-page')],
  }),
]
```

That effect copies any answers stored under the pattern's key in the
session into the form context. Each question step saves on valid
submission:

```typescript
submit({
  validate: true,
  onValid: {
    effects: [PatternEffects.SaveAnswers('single-question-per-page')],
    next: [redirect({ goto: 'your-role' })],
  },
})
```

Because the load hook runs on every access, returning to a completed
step shows the previous answer pre-filled. This is what makes the
change links on check-answers feel natural.

### Check your answers

The summary list uses `Answer()` expressions to read each stored
value, and relative `href` values so the change link points to the
original step:

```typescript
GovUKSummaryList({
  rows: [
    {
      key: { text: 'Name' },
      value: { text: Answer('fullName') },
      actions: {
        items: [{ href: 'your-name', text: 'Change', visuallyHiddenText: 'name' }],
      },
    },
  ],
})
```

### Confirmation and reset

The confirmation step owns a `ClearAnswers` access hook so reloading
it (or following the restart button) always starts fresh:

```typescript
onAccess: [
  access({
    effects: [PatternEffects.ClearAnswers('single-question-per-page')],
  }),
]
```

---

## Variations

- **Optional questions.** Drop `Condition.IsRequired()` from a
  field's `validWhen` to let the user skip it. The summary can show
  "Not provided" with a `match()` expression when the answer is
  empty.
- **Conditional next step.** Replace the single redirect with a
  list of redirects that each have a `when` condition to branch based
  on an earlier answer.
- **Per-step load/save.** If different sections of a journey save to
  different back-ends, move the load/save hooks from the journey to
  each step so they only run when relevant.
