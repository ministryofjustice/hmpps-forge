---
title: tieBreaker()
slug: tie-breaker
section: reference
path: reference/tie-breaker
nav: Authoring API/Reachability
order: 80
description: Creates a priority rule that resolves ambiguity when multiple steps are reachable
teaches: [tieBreaker, reachability, priority, entry-resolution, resume]
prerequisites: [step]
related:
  reference: answer, condition, and
---

# `tieBreaker()`

`tieBreaker()` creates a priority rule for a step. When multiple steps are reachable
at the same position - competing entry points, branching targets, or resume candidates
\- the step with the highest priority wins.

```typescript
import { tieBreaker } from '@ministryofjustice/hmpps-forge/core/authoring'

// Give this step a fixed priority
tieBreaker({ priority: 200 })

// Apply a priority only when a condition holds
tieBreaker({
  priority: 200,
  when: Session('formSubmitted').match(Condition.Equals(true)),
})

// Conditional priority with a catch-all fallback
tieBreaker({ priority: 200, when: Answer('status').match(Condition.Equals('complete')) }),
tieBreaker({ priority: 50 }),
```

You add tie-breakers to a step's `reachability.tieBreakers` array. They resolve
ambiguity that `entryWhen` and branching create - without
them, declaration order alone decides which step wins, and that is fragile. For
controlling whether a step is reachable at all, use `entryWhen` instead. Tie-breakers
do not affect reachability - they only choose among steps that are already reachable.

---

## Reference

### `tieBreaker(options)`

Creates a priority rule for a step's reachability configuration.

```typescript
function tieBreaker(options: TieBreakerProps): TieBreaker
```

:::param
---
name: priority
type: "number"
required: true
---
The priority value for this rule. Higher numbers win over lower numbers. Any step
with a priority beats any step without one. There are no constraints on the number
itself - negative values and decimals are valid, but the convention is to use round
positive numbers like `100` and `200`.
:::

:::param
---
name: when
type: "PredicateExpr"
required: false
---
A predicate that must hold for this priority to apply. This is what `.match()` on a
reference produces - for example,
`Session('submitted').match(Condition.Equals(true))`. Combinator expressions built
with [`and()`](./and), [`or()`](./or), and
[`not()`](./not) are also accepted. Omit `when` to make the rule
unconditional (a catch-all).
:::

#### Returns

A `TieBreaker` - an object with `type`, `priority`, and an optional `when` predicate.
Place it in the `reachability.tieBreakers` array on a step configuration.

#### Caveats

- A catch-all entry (no `when`) ends the chain.

- `Post()` references in a `when` predicate compile without error but always evaluate to
  `undefined`. The reachability context does not include `post`, so the predicate never
  matches.

---

## Usage

### Set a fixed priority on a step

The most common pattern is an unconditional tie-breaker that gives a step a constant
priority:

```typescript
const confirmation = Step('confirmation', {
  reachability: {
    entryWhen: Session('formSubmitted').match(Condition.Equals(true)),
    tieBreakers: [tieBreaker({ priority: 200 })],
  },
})

const overview = Step('overview', {
  reachability: {
    tieBreakers: [tieBreaker({ priority: 100 })],
  },
})
```

Both steps are entry points. When a user has submitted the form, both are reachable,
so the tie-breaker decides where they land. The confirmation step wins because 200 is
higher than 100.

### Choose a priority based on a condition

Add a `when` predicate to apply different priorities depending on state:

```typescript
tieBreakers: [
  tieBreaker({
    priority: 200,
    when: Session('formSubmitted').match(Condition.Equals(true)),
  }),
  tieBreaker({ priority: 50 }),
],
```

Rules are evaluated top to bottom. The first rule whose `when` matches - or the first
rule with no `when` - sets the priority. Later rules are ignored. In this example, the
step gets priority 200 after submission and priority 50 otherwise.

### Control the default entry point

When a journey has multiple conditional entry points, tie-breakers determine where a
user lands on first visit:

```typescript
const taskList = Step('task-list', {
  reachability: {
    tieBreakers: [tieBreaker({ priority: 100 })],
  },
})

const review = Step('review', {
  reachability: {
    entryWhen: Session('allTasksComplete').match(Condition.Equals(true)),
    tieBreakers: [tieBreaker({ priority: 200 })],
  },
})
```

On first visit, only the task list is reachable (the review's `entryWhen` is false),
so the user lands there. Once all tasks are complete, both are reachable and the
review step wins with the higher priority.

### Control the resume destination

Tie-breakers also affect where a returning user resumes. When multiple entry points
are reachable and the user has equal progress in each, the tie-breaker picks the
winner. This means a submitted user resumes on the confirmation page rather than the
overview, without any extra configuration.

---

## Troubleshooting

### A catch-all rule shadows conditional rules after it

Rules are evaluated top to bottom. The first match wins. A rule with no `when` always
matches, so it shadows every rule below it:

```typescript
// Wrong - the catch-all fires first, priority is always 50
tieBreakers: [
  tieBreaker({ priority: 50 }),
  tieBreaker({ priority: 200, when: somePredicate }),
],

// Right - conditional rules first, catch-all last
tieBreakers: [
  tieBreaker({ priority: 200, when: somePredicate }),
  tieBreaker({ priority: 50 }),
],
```

Place conditional rules before any catch-all rule.

### Tie-breaker placed outside `reachability.tieBreakers`

`tieBreaker()` can only appear inside a step's `reachability.tieBreakers` array. If
you place it in a journey configuration, another step property, or a field
configuration, you get a compile-time error:

> Tie-breakers can only be used in a step's reachability configuration

Move the `tieBreaker()` call into the `reachability.tieBreakers` array on the step
that needs the priority.

### Two steps have the same priority

When two competing steps resolve to the same priority number, the step declared first
in the journey wins. This is stable but not obvious to a reader. Give competing steps
distinct priorities so the intended winner is clear from the configuration alone.

### A step with no tie-breaker always loses

A step with no `tieBreakers` array - or whose rules all have a `when` that does not
match - has no priority. Any step with a priority beats it, regardless of how low that
priority is. If a step must be able to win a tie, give it at least a low-priority
catch-all rule.
