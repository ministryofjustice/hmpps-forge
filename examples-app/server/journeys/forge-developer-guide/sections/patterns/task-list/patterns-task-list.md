---
title: Task list page
section: patterns
path: patterns/task-list
teaches: [GovUKTaskList, match, and, not, visibleWhen, task-status, gated-tasks, hub-and-spoke, SetAnswer, GovUKUtilityClasses, entryWhen, backlink, children, Session, tieBreaker]
prerequisites: [journey, step, Answer, Condition, match, effects]
---

<p class="govuk-caption-xl">Patterns</p>

# Task list page
A hub page that breaks a complex service into named tasks, each with
a completion status. Users can complete tasks in any order (subject to
prerequisites) and return to the hub between sections.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/task-list" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Reach for this pattern when a service has several distinct sections
that can be completed in any order, and you want users to see their
overall progress at a glance.

It fits well when:

- The service has 3 or more sections with multiple questions each.
- Sections are largely independent of each other.
- Users may need to leave and return between sections.
- Some sections have prerequisites that must be completed first.

If the service is strictly linear (each step must follow the previous
one), prefer a single sequential journey with a
[resume](resuming) pattern instead.

---

## What the pattern covers

The live demo works end-to-end. Following the flow shows:

- **A task list page** using `GovUKTaskList` with dynamic status tags.
- **Child journeys** for multi-step sections, keeping each section's
  steps encapsulated with their own routing.
- **Explicit status tracking** where each section sets a status answer
  (`in-progress` or `completed`) on submission.
- **`match()` expressions** that derive the entire tag object (text
  and classes) from a single status answer per section.
- **Gated tasks** using dual items with `visibleWhen` and `not()` -
  one unlocked version with an `href`, one locked version with a
  grey "Cannot start yet" tag.
- **Conditional `entryWhen`** on gated steps to block direct URL
  access until prerequisites are met.
- **`GovUKUtilityClasses.Tag`** constants for tag colours instead of
  raw CSS class strings.
- **Hub-and-spoke navigation** where each section's final step
  redirects back to the task list via `../tasks`.
- **Session-based reachability** on the confirmation page, which
  survives draft answer clearing.

---

## Anatomy of the flow

```
/forge-developer-guide/patterns/demos/task-list/
├── /overview                              → Landing page (demo aid)
├── /tasks                                 → Task list hub
├── /your-details/                         → Child journey: section 1
│   ├── /your-name                         →   Step 1: visitor name
│   └── /relationship                      →   Step 2: relationship (→ hub)
├── /visit-preferences/                    → Child journey: section 2
│   ├── /preferred-day                     →   Step 1: preferred day
│   └── /visit-type                        →   Step 2: visit type (→ hub)
├── /additional-needs                      → Section 3: accessibility (gated)
├── /check-answers                         → Review all answers (gated)
└── /confirmation                          → Submission panel
```

Multi-step sections are modelled as child journeys with their own
path prefix. Each section's last step redirects to the parent
journey's `/tasks` hub using `../tasks`. The task list re-evaluates
status on every access because the journey's `onAccess` hook loads
saved answers into the form context.

---

## How it works

### Tracking section status

Each section stores its progress in a dedicated status answer. The
first step in a section sets the status to `'in-progress'` on valid
submission; the last step sets it to `'completed'`:

```typescript
// First step in a child journey: marks the section as started
submit({
  validate: true,
  onValid: {
    effects: [
      PatternEffects.SetAnswer('yourDetailsStatus', 'in-progress'),
      PatternEffects.SaveDraftAnswers('task-list'),
    ],
    // Next step within this child journey
    next: [redirect({ goto: 'relationship' })],
  },
})

// Last step in a child journey: marks the section as done
submit({
  validate: true,
  onValid: {
    effects: [
      PatternEffects.SetAnswer('yourDetailsStatus', 'completed'),
      PatternEffects.SaveDraftAnswers('task-list'),
    ],
    // '../tasks' crosses back to the parent journey's hub
    next: [redirect({ goto: '../tasks' })],
  },
})
```

`SetAnswer` writes a value into the form context before
`SaveDraftAnswers` persists it. The task list never needs to know
which fields each section collects - it just reads the status answer.

Because sections live in child journeys, the final redirect uses
`../tasks` to navigate up one level to the parent journey's hub step.
Redirects within a child journey (such as `goto: 'relationship'`)
resolve relative to that child journey's path.

---

### Rendering status with match

The task list page uses `match()` to map each status value to a
complete tag object. Because `match()` supports object return values,
a single helper produces both the text and CSS classes:

```typescript
import { GovUKUtilityClasses } from '@ministryofjustice/hmpps-forge/govuk-components'

const { Tag } = GovUKUtilityClasses

const lockedTag = { text: 'Cannot start yet', classes: Tag.Grey }
const notStartedTag = { text: 'Not yet started', classes: Tag.Grey }
const inProgressTag = { text: 'In progress', classes: Tag.Blue }
const completedTag = { text: 'Completed', classes: Tag.Green }

const statusTag = (code: string) =>
  match(Answer(code))
    .branch(Condition.Equals('completed'), completedTag)
    .branch(Condition.Equals('in-progress'), inProgressTag)
    .otherwise(notStartedTag)
```

Each task item then passes the result directly to `status.tag`:

```typescript
{
  title: { text: 'Your details' },
  // Links into the child journey: journey-path/step-path
  href: 'your-details/your-name',
  status: { tag: statusTag('yourDetailsStatus') },
}
```

Three states emerge from the status value:

- **Completed** - the last step in the section was submitted;
  green tag.
- **In progress** - the first step was submitted but the last was
  not; blue tag.
- **Not yet started** - no status answer exists; grey tag.

Use `GovUKUtilityClasses.Tag` for tag colours rather than raw CSS
class strings. The available colours are `Blue`, `Green`, `Grey`,
`Red`, `Orange`, `Yellow`, `Purple`, `Teal`, and `Magenta`.

---

### Gating a task with prerequisites

When a task depends on earlier sections being complete, combine their
status predicates with `and()`:

```typescript
const task1Done = Answer('yourDetailsStatus').match(Condition.Equals('completed'))
const task2Done = Answer('visitPreferencesStatus').match(Condition.Equals('completed'))
const prerequisitesMet = and(task1Done, task2Done)
```

Use two items with opposite `visibleWhen` conditions - one for the
unlocked state (with an `href` and dynamic status tag) and one for
the locked state (no `href`, grey tag):

```typescript
{
  title: { text: 'Additional needs' },
  hint: { text: 'Accessibility or other requirements' },
  href: 'additional-needs',
  visibleWhen: prerequisitesMet,
  status: { tag: statusTag('additionalNeedsStatus') },
},
{
  title: { text: 'Additional needs' },
  hint: { text: 'Accessibility or other requirements' },
  visibleWhen: not(prerequisitesMet),
  status: { tag: lockedTag },
},
```

Only one item is visible at a time. The locked version omits `href`,
so the GOV.UK task list renders the title as plain text rather than a
link. The grey "Cannot start yet" tag communicates that the task is
not available yet.

This dual-item approach is cleaner than nesting `Conditional`
expressions inside individual tag properties, because the locked and
unlocked states need completely different rendering (different tag,
presence or absence of a link).

---

### Structuring sections as child journeys

Multi-step sections are modelled as child journeys using the
`children` property. Each child journey has its own path prefix and
steps, keeping sections encapsulated:

```typescript
// your-details/journey.ts
export const yourDetailsJourney = journey({
  code: 'your-details',
  title: 'Your details',
  path: '/your-details',
  steps: [yourNameStep, relationshipStep],
})
```

The parent journey references child journeys alongside its own steps:

```typescript
journey({
  code: 'task-list-demo',
  path: '/task-list',
  steps: [overviewStep, tasksStep, additionalNeedsStep, ...],
  children: [yourDetailsJourney, visitPreferencesJourney],
})
```

The first step in each child journey needs `reachability: { entryWhen:
true }` so it can be accessed from the task list link. Set
`backlink: '../tasks'` to point the back link to the hub in the
parent journey:

```typescript
step({
  code: 'your-name',
  path: '/your-name',
  reachability: { entryWhen: true },
  backlink: '../tasks',
  ...
})
```

---

### Hub-and-spoke navigation

Each section's final step redirects back to the task list on valid
submission. Because sections are child journeys, the redirect uses
`../tasks` to navigate up to the parent journey's hub:

```typescript
// Last step in a child journey
next: [redirect({ goto: '../tasks' })],
```

Redirects within a child journey use plain step codes - for example,
`redirect({ goto: 'relationship' })` navigates to the next step
in the same child journey. The `SaveDraftAnswers` effect persists
the user's progress (including the updated status) so the task list
re-evaluates on the next render.

---

### Gating steps with conditional entry points

The task list uses `visibleWhen` to hide links, but users could
still navigate to a gated step by typing the URL directly. Use
`entryWhen` with a condition to block access at the reachability
level:

```typescript
const prerequisitesMet = and(
  Answer('yourDetailsStatus').match(Condition.Equals('completed')),
  Answer('visitPreferencesStatus').match(Condition.Equals('completed')),
)

step({
  code: 'additional-needs',
  reachability: { entryWhen: prerequisitesMet },
  backlink: 'tasks',
  ...
})
```

If the condition evaluates to `false`, the reachability system
redirects the user to the first available entry point instead of
rendering the page. The `backlink` override points back to the task
list since gated steps have no natural predecessor.

---

### Confirmation and session-based reachability

The check-answers step clears draft answers on submission (the
permanent answers are saved separately). This means answer-based
`entryWhen` conditions on downstream steps would fail - the status
answers no longer exist in the draft context.

The confirmation step solves this by using a session-based condition
instead:

```typescript
step({
  code: 'confirmation',
  reachability: {
    entryWhen: Session('patternSubmitted.task-list').match(Condition.Equals(true)),
    tieBreakers: [tieBreaker({ priority: 100 })],
  },
  ...
})
```

`SaveSubmitStateToSession` writes to the session before
`ClearDraftAnswers` runs, so the session value survives the clearing.
The `tieBreaker` gives the confirmation step a higher priority than
the always-true `tasks` and `overview` entry points, so a user who
reopens the journey after submitting lands on the confirmation page
rather than the hub.

---

### Loading answers on access

The journey's `onAccess` hook loads saved answers before any step
renders, including the task list:

```typescript
journey({
  code: 'task-list-demo',
  path: '/task-list',
  onAccess: [
    access({
      effects: [PatternEffects.LoadDraftAnswers('task-list')],
    }),
  ],
  steps: [...],
  children: [yourDetailsJourney, visitPreferencesJourney],
})
```

This ensures the `match()` and `visibleWhen` expressions on the task
list page always evaluate against the latest saved state.

---

## Variations

- **Resuming within a section.** Combine with the
  [resume](resuming) pattern inside each section so users
  who abandon mid-section pick up where they left off.
- **Dynamic task list.** Use `visibleWhen` on task items to show or
  hide tasks based on earlier answers (for example, a "Business
  details" task that only appears for business applicants).
- **Progress count.** Add a summary line above the task list showing
  "You have completed X of Y sections" using `match()` expressions
  that count completed predicates.
