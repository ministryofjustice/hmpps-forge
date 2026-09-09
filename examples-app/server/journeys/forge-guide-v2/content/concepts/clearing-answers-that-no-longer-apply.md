---
title: Clearing answers that no longer apply
slug: clearing-answers-that-no-longer-apply
section: concepts
path: concepts/clearing-answers-that-no-longer-apply
nav: Validation and journey progress
order: 17
description:
  How Forge clears field answers and branch answers when the user's current path changes
teaches:
  [
    answer-clearing,
    dependentWhen,
    reachability-cleardown,
    stale-answers,
    dynamic-field-codes,
  ]
prerequisites: [how-answers-work, how-forge-decides-where-users-can-go]
related:
  concept:
    [
      how-answers-work,
      how-forge-decides-where-users-can-go,
      working-with-repeated-data,
    ]
  reference: [journey, step, field]
---

# Clearing answers that no longer apply

Answers can outlive the situation that created them.

A user chooses email as their contact method, enters an email address, then goes back and
chooses phone. Answers go stale in the same way when a branch answer changes after several
steps, or when an item disappears from a repeated list. The old answer keeps influencing
validation, reachability, rendering, or saving even though it no longer belongs to the
user's current path.

Forge clears those answers as part of request evaluation.

## Clearing protects the current path

Forge treats answer state as part of the current journey path.

When the user changes an answer, the path can change with it, but old answers from the
previous path don't stop affecting the request on their own. Forge must remove them.

In a benefit application that asks whether the user has a partner, answering yes opens
partner questions. If the user later changes the answer to no, the partner answers are
stale. Stale answers can show the wrong check-answers row, trigger validation for a
skipped branch, or save data the user no longer means to provide.

Clearing is how Forge keeps the answer state aligned with the path the user is on now.

## Field dependencies clear local answers

`dependentWhen` ties a field's answer lifetime to a condition. When the condition is false
on a `POST`, Forge clears the answer.

```ts
GovUKTextInput({
  code: "emailAddress",
  label: "Email address",
  visibleWhen: Answer("contactMethod").match(Condition.Equals("email")),
  dependentWhen: Answer("contactMethod").match(Condition.Equals("email")),
});
```

The visibility rule controls what the user sees, while the dependency rule controls
whether Forge keeps the answer.

Because the two rules are independent, a field with only `visibleWhen` can disappear from
the page while its saved answer stays active. When both props carry the same condition,
the page and the answer state agree, and the answer rule sits next to the field that owns
the answer.

## Reachability clears branch answers

Some stale answers belong to whole steps rather than individual fields.

When reachability decides that a step no longer belongs to the user's current path, Forge
clears the answers for fields on that step.

This is broader than `dependentWhen`. A branch can contain many fields across many steps,
and repeating the same branch condition on every field would scatter one rule across the
journey. Reachability already knows which steps are reachable, so Forge uses that same
model to clear answers from unreachable steps.

The result is that branch rules live in the flow, not scattered through submit hooks.

## Clearing happens before later page work

Clearing happens after Forge evaluates reachability and before the current step's entry or
submit behaviour continues.

That order matters. Later entry validation, submit validation, submit hooks, rendering,
and saving all read the current path's answers. If an earlier choice just closed a branch,
later logic no longer sees answers from that branch.

On a `POST`, Forge records the submitted value first and then clears it when the dependency
or branch no longer applies. The mutation history preserves both events: the user submitted
a value, and then Forge removed it from the current answer state for a recorded reason.

## Dynamic field codes need patterns

Forge discovers ordinary field codes from a step's blocks, but repeated pages and dynamic
fields create answer keys that depend on item data:

```ts
GovUKTextInput({
  code: Format("task.%1.status", Item().path("id")),
  label: Format("Status for %1", Item().path("name")),
});
```

If the step becomes unreachable later, Forge cannot derive those keys from the blocks
alone, because the keys depend on data that is no longer present. Cleardown patterns on
the step tell Forge which stored answer keys belong to that dynamic shape.

```ts
step({
  path: "task-statuses",
  title: "Task statuses",
  cleardownFieldCodes: ["^task\\.[^.]+\\.status$"],
});
```

Forge matches the pattern against existing answer keys to recognise stored answers that
belong to the step. The pattern never creates answer keys of its own.

## Forge can keep safe forward answers

Going back in a journey does not make later answers stale when the forward path still
applies.

If a user edits an earlier step but the same forward path still applies, the answers on
later steps stay useful. For example, fixing a spelling mistake on a personal details page
doesn't invalidate the contact details page when the path between them still holds.

Forge uses reachability to distinguish answers that are still on a safe forward path from
answers that belong to closed branches. This is why accurate reachability depends on
loading answers for the journey, not only the current step.
