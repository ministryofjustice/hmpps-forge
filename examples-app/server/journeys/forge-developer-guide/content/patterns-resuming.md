---
title: Resuming a partially-completed journey
section: patterns
path: patterns/resuming
teaches: [resume, resumeWhen, session-persistence, LoadAnswers, ClearAnswers, reachability]
prerequisites: [journey, step, Answer, session, submit]
---

<p class="govuk-caption-xl">Patterns</p>

# Resuming a partially-completed journey
A service that lets users leave and come back later. When the user hits the
journey root, Forge picks the step they still need to complete and redirects
them there - no per-step landing logic required.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/resuming" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Reach for this pattern whenever a user might reasonably close the tab
halfway through a form and come back later. That covers most service
journeys longer than two or three questions. Sending the returning user
straight to the step they still need saves them re-navigating the form,
and the same URL works for fresh users.

It fits well when:

- Answers are stored in the session or an equivalent per-user store.
- The journey has a defined forward graph (each step's `onSubmission`
  declares where it sends the user next).
- The cost of starting over is non-trivial (the form is long, or the
  user has already made decisions they would not want to repeat).

If the journey is a single page, or the answers live in durable storage
already surfaced through a task list, prefer that pattern instead.

---

## How Forge resolves the resume target

Setting `resumeWhen` on a journey activates resume behaviour. When the
condition is true, Forge walks the journey's reachability graph to find
the step the user should be on:

1. Pick the entry point (the step with `reachability: { entryWhen: true }`).
2. If that step is invalid - a required answer is missing - stop and
   redirect there.
3. Otherwise follow the step's forward outcome to the next step and
   repeat.
4. If the graph ends with every step valid, redirect to the terminal
   valid step (typically a check-your-answers page).

A fresh user falls out naturally: the entry step is invalid because no
answers are set, so the resolver returns the entry path on the first
iteration.

The resume check runs on both the journey root and direct step URLs.
If a user bookmarks a step and comes back later, `resumeWhen` still
evaluates and sends them to the right place.

Because the walk uses the same reachability graph the engine already
builds for validation, there is no extra authoring - declaring each
step's `onSubmission` and setting `resumeWhen` on the journey is
enough.

---

## Anatomy of the flow

```
/forge-developer-guide/patterns/demos/resuming/
├── /                         → Journey root: evaluates resumeWhen, redirects
├── /overview                 → Landing page with seed/clear buttons (entry point, demo aid)
├── /your-name                → First question (entry point, tie-breaker priority 100)
├── /your-role                → Second question
├── /check-answers            → Summary with change links
└── /confirmation             → Submission panel (conditional entry, reachable after submit)
```

Both `/overview` and `/your-name` are entry points. Without
`reachability: { entryWhen: true }` the reachability walk would treat
`/overview` as unreachable and Forge would redirect visitors away from it.
A `tieBreakers` array on `/overview` gives it a higher priority than
`/your-name`, so Forge lands users on the overview page by default
rather than jumping straight into the first question.

None of the question steps know anything about resume logic. The
forward graph alone tells Forge where each step leads.

The overview page includes buttons that seed or clear session state
so you can see the resolver pick different destinations without
walking through the journey first. These are demo aids, not part of
the pattern - a real service would never seed answers directly.

---

## How it works

### Load answers on every access

The journey carries a single `onAccess` effect that copies any stored
answers back into the form context before any step - including the
resume handler - evaluates:

```typescript
journey({
  code: 'resuming-demo',
  path: '/resuming',
  reachability: { resumeWhen: true },
  onAccess: [
    access({
      effects: [PatternEffects.LoadAnswers('resuming')],
    }),
  ],
  steps: [overviewStep, yourNameStep, yourRoleStep, checkAnswersStep, confirmationStep],
})
```

`resumeWhen: true` means every request to this journey triggers the
resume check. For journeys where users need to go back and change
answers (for example, via change links on a check-answers page), use a
conditional `resumeWhen` instead.

The resolver evaluates step validity against this context, so missing
answers mark their step invalid and become the resume target.

### Declare a forward graph

Each question step's `onSubmission` names the next step. That
declaration is what the resolver follows when walking forward:

```typescript
step({
  code: 'your-name',
  path: '/your-name',
  reachability: { entryWhen: true },
  blocks: [fullNameField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [PatternEffects.SaveAnswers('resuming')],
        next: [redirect({ goto: 'your-role' })],
      },
    }),
  ],
})
```

`SaveAnswers` on each valid submission keeps the session in step with
the user's progress, so the next visit to the journey root resumes
from the right place.

### Clearing answers

Clearing stored answers can be handled by an `onAction` hook on
any step. The overview page in this demo includes a button that clears
both committed and draft answers, then re-renders the page:

```typescript
action({
  when: Post('action').match(Condition.Equals('clear')),
  effects: [
    PatternEffects.ClearAnswers('resuming'),
    PatternEffects.ClearDraftAnswers('resuming'),
  ],
})
```

With the session wiped, the next visit to the journey root finds the
entry step invalid and redirects there - the resolver does not need
to know about the clear flow.

---

### Conditional entry for the confirmation page

After submission, the user's draft answers are cleared - they have been
committed. Without a way to make the confirmation page reachable
independently, Forge would see the preceding question steps as
incomplete and redirect the user back to the start.

A conditional entry point solves this. The confirmation step declares
`entryWhen` with a session condition that is only true after submission,
and a tie-breaker with a priority high enough to win over the question
steps:

```typescript
step({
  code: 'confirmation',
  path: '/confirmation',
  reachability: {
    entryWhen: Session('patternSubmitted.resuming').match(Condition.Equals(true)),
    tieBreakers: [tieBreaker({ priority: 200 })],
  },
  ...
})
```

When the condition is true, the step becomes an entry point - Forge
treats it as reachable regardless of earlier steps. The tie-breaker
gives it a higher priority than the question steps, so Forge sends
the user to confirmation rather than the first question.

When the user restarts, the session flag is cleared, the condition
evaluates to false, and the step is no longer an entry point - Forge
resumes from the first incomplete question as usual.

---

## Variations

- **Tie-breakers on branching journeys.** When the forward graph
  branches, add `tieBreakers` to each candidate step so the resolver
  can pick a winner. The same tie-breaker also disambiguates backlink
  and redirect resolution.
- **Durable storage.** Swap the session-backed `LoadAnswers` /
  `SaveAnswers` effects for ones that read and write to a per-user
  store. `Forge` does not care where the answers come from -
  it just evaluates the context that the access hooks populate.
- **Per-step save.** The demo saves on every question submission,
  which is what gives the resolver accurate validity state for each
  step. Delay that to the end of the journey and resume collapses to
  the entry point only.
