---
title: Reachability and resuming
section: building-journeys
path: building-journeys/reachability
teaches: [reachability, reachability-graph, validity, frontier, progress, backlinks, linearised-path, tieBreakers, field-cleardown, cleardownFieldCodes, getFieldsToClear, resumeWhen, disableReachabilityChecks]
prerequisites: [routing, entryWhen, step, journey]
---

<p class="govuk-caption-xl">Routing, reachability and navigation</p>

# Reachability and resuming

Reachability controls which steps a user can access based on their
progress through a journey. It prevents users from skipping ahead,
redirects returning users to the right place, and keeps stored answers
in sync with the path they actually took.

{{slot:toc}}

---

## What is reachability?

In a sequential journey, users should not be able to jump to step 5
by typing its URL when they have only completed step 2. Reachability
enforces this. On every request, Forge evaluates which steps the user
can currently reach and redirects them if they try to access one they
cannot.

Reachability also has a data dimension. When a user goes back and
changes an earlier answer, steps that were previously reachable may
no longer be. Any answers stored for those now-unreachable steps
become stale and need to be cleared.

---

## The reachability graph

On every GET and POST request, Forge builds a directed graph of steps
to answer the question: can this user be on this step right now?

### Entry points seed the graph

Entry points are steps that are always reachable. They seed the graph
walk - without at least one entry point, no step can be reached.

```typescript
step({
  path: '/your-name',
  title: 'What is your name?',
  reachability: { entryWhen: true },
  ...
})
```

A conditional entry point is only active when its condition is true:

```typescript
step({
  path: '/confirmation',
  title: 'Submitted',
  reachability: {
    entryWhen: Session('submitted').match(Condition.Equals(true)),
  },
  ...
})
```

### Valid steps propagate; invalid steps block

Starting from entry points, Forge follows forward edges (the
`redirect` declarations in your `onSubmission` hooks) to discover
which downstream steps are reachable:

- A **valid** step (all its required fields have answers) propagates:
  its successors become reachable.
- An **invalid** step (missing or incorrect answers) does **not**
  propagate: its successors stay unreachable unless reached via
  another path.

```
[entry]  →  [step-2]  →  [step-3]  →  [step-4]
   ✓           ✓            ✗
reachable   reachable   reachable    unreachable
                        (invalid,    (step-3 didn't
                         blocks)      propagate)
```

Steps with no fields are trivially valid - they always propagate.

### Forward edges come from your hooks

Forge discovers the graph by evaluating the `redirect` outcomes in
each step's `onSubmission` hooks. You do not declare a separate
navigation graph - the reachability system reads the same forward
edges that handle real submissions:

```typescript
onSubmission: [
  submit({
    validate: true,
    onValid: {
      next: [redirect({ goto: 'your-role' })],
    },
  }),
]
```

This tells Forge that `your-name` leads to `your-role`. If
`your-name` is valid, `your-role` becomes reachable.

---

## The linearised path

The reachability graph may branch (one step with multiple forward
edges) or converge (one step reachable from multiple predecessors).
Forge collapses it into a single ordered path using tiebreakers.

At every branch, the tiebreaker-winning successor is chosen. The
result is one route through the journey:

```
[step-1, step-2, step-3, step-4, step-5]
```

This path is recalculated on every request - it shifts as answers
change, conditions evaluate differently, and the user makes progress.

The linearised path is the foundation for three things: the frontier,
backlinks, and resume.

---

## The frontier

The frontier is the step on the linearised path where the user should
pick up. It tells Forge where to send a returning user.

**First invalid non-entry step.** Walk the path from the start. The
first step that has validation requirements and fails them is the
frontier:

```
[entry, form-1, form-2, form-3]
   ✓      ✓       ✗       ✗
                  ↑
               frontier
```

**Terminal step after progress.** If every step on the path is valid,
the frontier is the last step - but only when real progress exists
earlier (at least one step with fields has been completed). This
covers check-your-answers pages:

```
[entry, form-1, form-2, check-answers]
   ✓      ✓       ✓         ✓
                            ↑
                         frontier
```

**No frontier.** If no step with validation exists or none are valid
yet, there is no frontier. The journey is either fresh or fully
complete.

---

## Progress

Progress determines whether resume has something to act on.

**Progress exists when** any reachable step that has validation
requirements is valid. This means the user has actually submitted data
for at least one form step.

A step with no fields (content pages, intro screens) does not count
as progress - it has nothing to complete.

---

## Resume

By default, reachability only prevents users from accessing steps
beyond their progress. Users can freely navigate back to earlier
steps.

Setting `resumeWhen` on a journey adds redirect-to-frontier
behaviour. When the condition is active, Forge redirects the user to
the frontier instead of letting them stay where they are.

```typescript
journey({
  code: 'travel-declaration',
  path: '/travel-declaration',
  title: 'Travel declaration',
  reachability: {
    resumeWhen: Query('resume').match(Condition.Equals('true')),
  },
  steps: [overviewStep, addTripStep, checkAnswersStep],
})
```

### Resume decision flow

```
Request arrives
    |
    v
Is resumeWhen condition true?
    |
    +-- No --> Normal reachability (render if reachable, else redirect to entry)
    |
    v Yes
Does progress exist?
    |
    +-- No --> No-op (user stays where they are)
    |
    v Yes
Does a frontier exist?
    |
    +-- No --> No-op (journey is complete)
    |
    v Yes
Is the frontier the current step?
    |
    +-- Yes --> No-op (already there)
    |
    v No
Redirect to frontier.
```

### Conditional versus always-on resume

`resumeWhen: true` means every request triggers resume. This is
aggressive - users cannot go back to change answers via direct links.

A conditional `resumeWhen` is more common. Use a query parameter so
that task list links include `?resume=true` while change links on a
check-answers page do not:

```typescript
reachability: {
  resumeWhen: Query('resume').match(Condition.Equals('true')),
}
```

See [Resuming a partially-completed journey](../patterns/resuming)
for a worked example with code.

---

## Backlinks

The backlink for a step is the previous step on the linearised path:

```
[step-1, step-2, step-3]
           ↑       ↑
       backlink   current
```

When a step has multiple predecessors (reachable from more than one
path), the tiebreaker determines which one sits on the linearised
path. That predecessor becomes the backlink.

If the canonical backlink does not match the user's actual navigation
(because they entered via a different door), use the `backlink`
property on the step definition to override it.

---

## Tiebreakers

Tiebreakers resolve ambiguity wherever the graph presents multiple
candidates: multiple entry points, multiple forward branches, or
multiple predecessors converging on one step.

Each tiebreaker rule has a `priority` number. Rules are evaluated
top-to-bottom; the first matching rule supplies the step's priority.
The highest priority among competing candidates wins.

```typescript
reachability: {
  entryWhen: true,
  tieBreakers: [tieBreaker({ priority: 100 })],
}
```

Conditional tiebreakers let a step's priority change based on state:

```typescript
tieBreakers: [
  tieBreaker({
    priority: 200,
    when: Session('submitted').match(Condition.Equals(true)),
  }),
  tieBreaker({ priority: 50 }),
]
```

When the condition is true, this step has priority 200. Otherwise it
falls through to the unconditional rule and gets priority 50.

---

## Root landing

When a user navigates to a journey's root URL (not a specific step),
Forge decides where to send them:

1. If `resumeWhen` is active and progress exists and a frontier
   exists, redirect to the frontier.
2. Otherwise, redirect to the tiebreaker-winning active entry point.
3. If no active entry point exists, redirect to the first step.

---

## Redirect rules (step requests)

When a user requests a specific step URL:

| Resume outcome | Step reachable | Result |
|---|---|---|
| Redirect to frontier | - | Redirect to frontier |
| No-op | Yes | Render the step |
| No-op | No | Redirect to tiebreaker-winning entry point |

---

## Field cleardown

When a user changes an earlier answer and a branch becomes
unreachable, answers from that branch become stale. Forge tracks
which fields belong to which steps so you can clear them.

### Automatic field tracking

Forge builds an inventory of every field on every step. If a step
becomes unreachable, its field codes are identified as stale:

```typescript
const countryField = GovUKSelectInput({
  code: 'tripCountry',
  label: { text: 'Which country did you visit?' },
  items: Data('countries'),
})
```

If the step containing `tripCountry` becomes unreachable, it appears
in the list returned by `getFieldsToClear()`.

### Dynamic field codes

Fields inside iterators produce codes that Forge cannot predict at
compile time (for example, `note-0`, `note-1`, `note-2`). Use
`cleardownFieldCodes` on the step to declare regex patterns that
match these dynamic codes:

```typescript
step({
  path: '/add-notes',
  title: 'Add notes',
  cleardownFieldCodes: ['^note-\\d+$'],
  blocks: [heading, notesIterator, continueButton],
})
```

You can mix exact codes and patterns:

```typescript
cleardownFieldCodes: ['tripCountry', 'tripDepartureDate', '^trip.*$']
```

### Using `getFieldsToClear()` in effects

The resolved list of stale field codes is available on the effect
function context. Call it in your save effect to clear abandoned
answers before persisting:

```typescript
SaveAnswers: deps => async (context, formCode) => {
  const sessionId = context.getSession()?.id
  if (!sessionId) return

  const fieldsToClear = context.getFieldsToClear()

  for (const field of fieldsToClear) {
    context.clearAnswer(field)
  }

  await deps.formDataStore.set(sessionId, formCode, context.getAllAnswers())
}
```

---

## Disabling reachability checks

If your journey is mainly for display rather than a sequential form
(like this developer guide), reachability gets in the way. Every step
would need entry points and hooks connecting them, even though users
should be free to visit any page in any order.

Set `disableReachabilityChecks: true` on the journey's `reachability`
config to skip the graph walk entirely. All steps are treated as
reachable without needing entry points or forward edges:

```typescript
journey({
  code: 'developer-guide',
  path: '/developer-guide',
  title: 'Developer Guide',
  reachability: { disableReachabilityChecks: true },
  steps: [blocksStep, fieldsStep, validationStep],
})
```

Child journeys inherit this setting. If a child journey needs
reachability (for example, a form demo embedded within a content
journey), override with an explicit `false`:

```typescript
journey({
  code: 'demo',
  path: '/demo',
  title: 'Live demo',
  reachability: { disableReachabilityChecks: false },
  steps: [overviewStep, questionStep, confirmationStep],
})
```

When reachability is disabled:

- No step needs `entryWhen` or `tieBreakers` to be accessible.
- `getFieldsToClear()` always returns an empty array (no unreachable
  steps exist).
- `resumeWhen` has no effect (there is no frontier to redirect to).
- The first step in the journey is used as the default landing when a
  user visits the journey root.

---

## API surface

### `resumeWhen` (Optional, journey)

Controls resume behaviour. Accepts `true` (always resume) or a
condition expression (resume only when the condition is true).

```typescript
reachability: {
  resumeWhen: Query('resume').match(Condition.Equals('true')),
}
```

### `disableReachabilityChecks` (Optional, journey)

When `true`, skips the reachability walk and treats all steps as
reachable. Inherited by child journeys; override with `false`.

```typescript
reachability: { disableReachabilityChecks: true }
```

### `entryWhen` (Optional, step)

Marks a step as an entry point. Accepts `true` (always) or a
condition expression (conditional entry).

```typescript
reachability: { entryWhen: true }
```

### `tieBreakers` (Optional, step)

Array of prioritised rules for resolving ambiguity. First matching
rule wins.

```typescript
reachability: {
  entryWhen: true,
  tieBreakers: [tieBreaker({ priority: 100 })],
}
```

### `cleardownFieldCodes` (Optional, step)

Array of regex patterns to match against stored answer keys when
this step becomes unreachable.

```typescript
cleardownFieldCodes: ['tripCountry', '^trip.*$']
```

### `getFieldsToClear()`

Returns field codes from unreachable steps. Available on the effect
function context.

```typescript
const staleKeys = context.getFieldsToClear()
```

---

## Best practices

- **Every journey with reachability needs at least one entry point.**
  Without one, no step seeds the graph and nothing is reachable.
- **Use conditional `resumeWhen` over always-on.** A query parameter
  like `?resume=true` lets change links work normally while task list
  links still trigger resume.
- **Put tiebreakers on entry points.** When multiple entries can be
  active, the tiebreaker determines where users land from the journey
  root.
- **Do not rely on step ordering for reachability.** Reachability
  follows forward edges from hooks, not the order steps appear in the
  array. If a step has no hook leading to it, it is unreachable.
- **Use `cleardownFieldCodes` for dynamic field codes.** If a step
  uses iterators or computed field codes, declare patterns so stale
  answers are identified when the step becomes unreachable.
- **Use `disableReachabilityChecks` for content journeys.** Do not
  mark every step as `entryWhen: true` - use the journey-level flag
  instead.
