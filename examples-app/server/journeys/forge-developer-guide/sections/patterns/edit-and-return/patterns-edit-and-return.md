---
title: Edit and return
section: patterns
path: patterns/edit-and-return
teaches: [edit-and-return, query-parameter-routing, change-links]
prerequisites: [single-question-per-page, onSubmission, redirect, query]
---

<p class="govuk-caption-xl">Patterns</p>

# Edit and return
A check-your-answers page with change links that jump the user to a
specific step and return them to the summary after saving, rather
than continuing the normal linear flow.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/edit-and-return" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Reach for this pattern when a journey has a summary page and users
need to correct individual answers without repeating the entire flow.
The GOV.UK Design System
[check answers pattern](https://design-system.service.gov.uk/patterns/check-answers/)
expects change links to jump to the relevant question and return to
the summary.

It fits well when:

- The journey has a check-your-answers page at the end.
- Each question is on its own page (single question per page).
- Users should be able to change one answer without revisiting
  every subsequent question.

It does not fit as well when steps depend heavily on earlier answers
(such as a branching flow where changing one answer invalidates
later steps). In that case, consider forcing the user through the
remaining steps so downstream answers are re-validated.

---

## What the pattern covers

The live demo works end-to-end. Following the flow shows:

- **Change links** on the summary list that append
  `?returnTo=check-answers` to the step URL.
- **Conditional redirects** in each step's submit hook that check
  `Query('returnTo')` before choosing the next destination.
- **First-time users** follow the linear flow (name → email →
  contact preference → summary) because no `returnTo` parameter is
  present.
- **Reviewers** who arrive via a change link are sent straight back
  to the summary after saving.
- **Confirmation** on a final panel, with a reset that clears the
  session-stored answers.

---

## Anatomy of the flow

```
/forge-developer-guide/patterns/demos/edit-and-return/
├── /                      → Overview and "Start" button
├── /full-name             → Field: fullName
├── /email-address         → Field: emailAddress
├── /contact-preference    → Radio: email | phone | post
├── /check-answers         → Summary list with change links
└── /confirmation          → Panel and restart
```

The first time through, each step redirects to the next. From the
summary page, each change link adds `?returnTo=check-answers` so
the edited step redirects back to the summary instead.

---

## How it works

### Change links with a query parameter

The summary list's change link for each row appends
`?returnTo=check-answers` to the step's relative URL:

```typescript
GovUKSummaryList({
  rows: [
    {
      key: { text: 'Full name' },
      value: { text: Answer('fullName') },
      actions: {
        items: [
          {
            href: 'full-name?returnTo=check-answers',
            text: 'Change',
            visuallyHiddenText: 'full name',
          },
        ],
      },
    },
    // ...more rows
  ],
})
```

The query parameter is just a string convention. The step itself
decides what to do with it.

### Conditional redirect in submit hooks

Each question step's submit hook checks whether `returnTo` is
present. If it is, the user goes back to the summary. If not, they
continue to the next question in the linear flow:

```typescript
submit({
  validate: true,
  onValid: {
    effects: [PatternEffects.SaveDraftAnswers('edit-and-return')],
    next: [
      redirect({
        when: Query('returnTo').match(Condition.Equals('check-answers')),
        goto: 'check-answers',
      }),
      redirect({ goto: 'email-address' }),
    ],
  },
})
```

The conditional redirect comes first. When `returnTo` is absent (or
has a different value), the `when` evaluates to false and Forge
falls through to the unconditional redirect below it.

### Why this works

The `returnTo` parameter exists only in the URL the user followed.
It is not stored in the session or form state. When the form
submits (a POST), the query string from the change link is still
in the browser's URL, so `Query('returnTo')` resolves to
`'check-answers'` during the submit lifecycle. After the redirect,
the query parameter is gone and the step is back to its default
behaviour.

---

## Variations

- **Multiple return targets.** If a step appears in more than one
  summary, use different `returnTo` values and add a redirect for
  each: `?returnTo=task-1-summary` and `?returnTo=task-2-summary`.
- **Preserving the returnTo through validation errors.** When a
  step re-renders with validation errors, the browser stays on the
  URL it POSTed to. Since the form's `action` does not include the
  query string by default, the `returnTo` parameter survives the
  re-render. Correcting the error and re-submitting still sends the
  user back to the summary.
- **Deep return paths.** `returnTo` can be any relative or absolute
  path, not just a sibling step code. For journeys with nested
  child journeys, you can set `returnTo` to a deeper path like
  `../../parent-summary`.
- **Combining with branching.** If a branching flow has a shared
  summary, each branch step can honour the same `returnTo`
  parameter. The summary page uses different change link URLs per
  branch but the same query parameter convention.
