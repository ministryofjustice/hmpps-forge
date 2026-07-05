---
title: Branching based on an earlier answer
section: patterns
path: patterns/branching
teaches: [branching, conditional-redirect, first-match-redirect]
prerequisites: [single-question-per-page, onSubmission, redirect]
---

<p class="govuk-caption-xl">Patterns</p>

# Branching based on an earlier answer
A sequential flow that routes users down different paths based on an
earlier answer. Each branch collects the information relevant to that
path and all branches converge on a shared check-your-answers summary.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/branching" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Reach for this pattern when a single up-front choice changes what you
need to ask the user next. A contact-method question that determines
whether to collect an email, phone number, or postal address is a
classic example.

It fits well when:

- The branches are meaningfully different, not just a change of label.
- Each branch has its own validation rules or integrations.
- The user should only see the questions relevant to their choice.

It does not fit as well when the branches differ by a single field on
an otherwise shared page. In that case, reach for a reveal field on a
radio option instead.

---

## What the pattern covers

The live demo works end-to-end. Following the flow shows:

- **A radio question** that determines the next step.
- **Conditional redirects** in a submit hook's `next` array, using
  first-match semantics to pick the right branch.
- **Three branch steps** that each collect different information.
- **A summary** with `visibleWhen` rows, so only the branch the user
  took appears.
- **Confirmation** on a final panel, with a reset that clears the
  session-stored answers.

---

## Anatomy of the flow

```
/forge-developer-guide/patterns/demos/branching/
├── /overview          → Overview and "Start" button
├── /visit-type        → Radio: in-person | video | phone
├── /location          → Office picker (in-person branch)
├── /video-email       → Email for calendar invite (video branch)
├── /phone-number      → Phone number (phone branch)
├── /check-answers     → Summary list with change links
└── /confirmation      → Panel and restart
```

Only one branch step is reachable per submission. The other two stay
unreachable until the user changes their answer to `visitType`.

---

## How it works

### Conditional redirects

The branching happens in the visit-type step's submit hook. The
`next` array holds a redirect per branch, each guarded by a `when`
condition, followed by an unconditional fallback:

```typescript
submit({
  validate: true,
  onValid: {
    effects: [PatternEffects.SaveDraftAnswers('branching')],
    next: [
      redirect({
        when: Answer('visitType').match(Condition.Equals('in-person')),
        goto: 'location',
      }),
      redirect({
        when: Answer('visitType').match(Condition.Equals('video')),
        goto: 'video-email',
      }),
      redirect({ goto: 'phone-number' }),
    ],
  },
})
```

Forge evaluates the entries in order. The first whose `when` is true
wins; the rest are skipped. The final redirect has no `when`, so it
acts as a fallback if none of the earlier conditions matched.

### Convergence on check-answers

Each branch step redirects to the same `check-answers` step on valid
submission. Because they all feed into one step, the summary only
needs to know which branch the user took, not which step they came
from:

```typescript
onValid: {
  effects: [PatternEffects.SaveDraftAnswers('branching')],
  next: [redirect({ goto: 'check-answers' })],
}
```

### A summary that follows the branch

The summary list defines a row per branch, each guarded by a
`visibleWhen` condition on `visitType`, so only the branch the user
took appears. The always-visible visit-type row uses `match()` to
turn the stored value into a friendly label:

```typescript
const visitTypeLabel = match(Answer('visitType'))
  .branch(Condition.Equals('in-person'), 'In person')
  .branch(Condition.Equals('video'), 'Video call')
  .branch(Condition.Equals('phone'), 'Phone call')
  .otherwise('')
```

The conditions are resolved at render time, so the summary always
reflects the user's current branch. Answers from other branches stay
in the session but are not displayed.

---

## Variations

- **Stale answers on branch change.** In this demo, switching from
  one branch to another leaves the old branch's answer in the
  session. That is sometimes what you want (a user who flips back to
  their previous choice sees their earlier answer). When you do not,
  set [`cleardownFieldCodes`](../building-journeys/reachability) on
  each branch step so Forge flags stale answers when the step
  becomes unreachable.
- **More than three branches.** The same shape scales to any number
  of options. Keep the unconditional fallback at the end of the
  `next` array so every submission lands somewhere.
- **Deeper branches.** A branch step can have its own branching
  submit hook, nesting the pattern. Use it sparingly. Two levels of
  conditional routing is usually fine; three becomes hard to reason
  about.
- **Multiple fields per branch.** A branch does not have to be a
  single step. Replace a branch's `goto` with the first step of a
  sub-journey that collects several fields before joining back.
