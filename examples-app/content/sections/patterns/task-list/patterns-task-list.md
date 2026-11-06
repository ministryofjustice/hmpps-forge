---
title: Task list page
section: patterns
path: patterns/task-list
teaches: [govuk::TASK_LIST, match, and, not, visibleWhen, task-status, gated-tasks, hub-and-spoke, SetAnswer, classes, entryWhen, backlink, children, session, tieBreaker]
prerequisites: [journey, step, answer, condition, match, effects]
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

- **A task list page** using `govuk::TASK_LIST` with dynamic status tags.
- **Child journeys** for multi-step sections, keeping each section's
  steps encapsulated with their own routing.
- **Explicit status tracking** where each section sets a status answer
  (`in-progress` or `completed`) on submission.
- **`match_()` expressions** that derive the entire tag object (text
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
first step in a section sets the status to `"in-progress"` on valid
submission; the last step sets it to `"completed"`:

```rust
// First step in a child journey: marks the section as started
submit(obj! {
    "validate": true,
    "onValid": obj! {
        "effects": [
            effect::call("SetAnswer", vec!["yourDetailsStatus".into(), "in-progress".into()]),
            effect::call("SaveDraftAnswers", vec!["task-list".into()]),
        ],
        // Next step within this child journey
        "next": [redirect(obj! { "goto": "relationship" })],
    },
})
// Last step in a child journey: marks the section as done
submit(obj! {
    "validate": true,
    "onValid": obj! {
        "effects": [
            effect::call("SetAnswer", vec!["yourDetailsStatus".into(), "completed".into()]),
            effect::call("SaveDraftAnswers", vec!["task-list".into()]),
        ],
        // '../tasks' crosses back to the parent journey's hub
        "next": [redirect(obj! { "goto": "../tasks" })],
    },
})
```

`SetAnswer` writes a value into the form context before
`SaveDraftAnswers` persists it. The task list never needs to know
which fields each section collects - it just reads the status answer.

Because sections live in child journeys, the final redirect uses
`../tasks` to navigate up one level to the parent journey's hub step.
Redirects within a child journey (such as `"goto": "relationship"`)
resolve relative to that child journey's path.

---

### Rendering status with match

The task list page uses `match_()` to map each status value to a
complete tag object. Because `match_()` supports object return values,
a single helper produces both the text and CSS classes:

```rust
use forge_govuk_components::classes;

fn locked_tag() -> Value {
    obj! { "text": "Cannot start yet", "classes": classes::tag::GREY }
}

fn not_started_tag() -> Value {
    obj! { "text": "Not yet started", "classes": classes::tag::GREY }
}

fn in_progress_tag() -> Value {
    obj! { "text": "In progress", "classes": classes::tag::BLUE }
}

fn completed_tag() -> Value {
    obj! { "text": "Completed", "classes": classes::tag::GREEN }
}

fn status_tag(code: &str) -> Value {
    match_(answer(code))
        .branch(condition::equals("completed"), completed_tag())
        .branch(condition::equals("in-progress"), in_progress_tag())
        .otherwise(not_started_tag())
        .into()
}
```

Each task item then passes the result directly to `status.tag`:

```rust
obj! {
    "title": obj! { "text": "Your details" },
    // Links into the child journey: journey-path/step-path
    "href": "your-details/your-name",
    "status": obj! { "tag": status_tag("yourDetailsStatus") },
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
status predicates with `and(vec![])`:

```rust
let task1_done = answer("yourDetailsStatus").matches(condition::equals("completed"));
let task2_done = answer("visitPreferencesStatus").matches(condition::equals("completed"));
let prerequisites_met = and(vec![task1_done, task2_done]);
```

Use two items with opposite `visibleWhen` conditions - one for the
unlocked state (with an `href` and dynamic status tag) and one for
the locked state (no `href`, grey tag):

```rust
obj! {
    "title": obj! { "text": "Additional needs" },
    "hint": obj! { "text": "Accessibility or other requirements" },
    "href": "additional-needs",
    "visibleWhen": prerequisites_met,
    "status": obj! { "tag": status_tag("additionalNeedsStatus") },
}
obj! {
    "title": obj! { "text": "Additional needs" },
    "hint": obj! { "text": "Accessibility or other requirements" },
    "visibleWhen": not(prerequisites_met),
    "status": obj! { "tag": locked_tag },
}
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

```rust
// your-details/journey.rs
let your_details_journey = journey(obj! {
    "code": "your-details",
    "title": "Your details",
    "path": "/your-details",
    "steps": [your_name_step, relationship_step],
});
```

The parent journey references child journeys alongside its own steps:

```rust
journey(obj! {
    "code": "task-list-demo",
    "path": "/task-list",
    "steps": [overview_step(), tasks_step(), additional_needs_step(), /* ... */],
    "children": [your_details_journey(), visit_preferences_journey()],
})
```

The first step in each child journey needs `reachability: { entryWhen:
true }` so it can be accessed from the task list link. Set
`"backlink": "../tasks"` to point the back link to the hub in the
parent journey:

```rust
step(obj! {
    "code": "your-name",
    "path": "/your-name",
    "reachability": obj! { "entryWhen": true },
    "backlink": "../tasks",
    // ...
})
```

---

### Hub-and-spoke navigation

Each section's final step redirects back to the task list on valid
submission. Because sections are child journeys, the redirect uses
`../tasks` to navigate up to the parent journey's hub:

```rust
// Last step in a child journey
"next": [redirect(obj! { "goto": "../tasks" })],
```

Redirects within a child journey use plain step codes - for example,
`redirect(obj! { "goto": "relationship" })` navigates to the next step
in the same child journey. The `SaveDraftAnswers` effect persists
the user's progress (including the updated status) so the task list
re-evaluates on the next render.

---

### Gating steps with conditional entry points

The task list uses `visibleWhen` to hide links, but users could
still navigate to a gated step by typing the URL directly. Use
`entryWhen` with a condition to block access at the reachability
level:

```rust
fn prerequisites_met() -> Value {
    and(vec![
        answer("yourDetailsStatus").matches(condition::equals("completed")),
        answer("visitPreferencesStatus").matches(condition::equals("completed")),
    ])
}

step(obj! {
    "code": "additional-needs",
    "reachability": obj! { "entryWhen": prerequisites_met() },
    "backlink": "tasks",
    // ...
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

```rust
step(obj! {
    "code": "confirmation",
    "reachability": obj! {
        "entryWhen": session("patternSubmitted.task-list").matches(condition::equals(true)),
        "tieBreakers": [tie_breaker(obj! { "priority": 100 })],
    },
    // ...
})
```

`SaveSubmitStateToSession` writes to the session before
`ClearDraftAnswers` runs, so the session value survives the clearing.
The `tie_breaker` gives the confirmation step a higher priority than
the always-true `tasks` and `overview` entry points, so a user who
reopens the journey after submitting lands on the confirmation page
rather than the hub.

---

### Loading answers on access

The journey's `onAccess` hook loads saved answers before any step
renders, including the task list:

```rust
journey(obj! {
    "code": "task-list-demo",
    "path": "/task-list",
    "onAccess": [
        access(obj! {
            "effects": [effect::call("LoadDraftAnswers", vec!["task-list".into()])],
        }),
    ],
    "steps": [/* ... */],
    "children": [your_details_journey(), visit_preferences_journey()],
})
```

This ensures the `match_()` and `visibleWhen` expressions on the task
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
  "You have completed X of Y sections" using `match_()` expressions
  that count completed predicates.
