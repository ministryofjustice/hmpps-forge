---
title: Validating collections with iterators
slug: collection-validation
section: patterns
path: patterns/collection-validation
nav: Validation
order: 18
description: Validate each active goal in a plan and show a separate message for goals missing actions.
---

# Validating collections with iterators

Validate both a collection as a whole and the items within it. This example
checks a sentence plan: it needs an active goal, and each active goal needs at
least one action before the submission can continue.

## Try the pattern

1. Open the agreement page, select an answer and continue to see errors naming goals without actions.
2. Select **Add actions to goals** and enter actions for the active goals that need them.
3. Return to the agreement page and continue again to see the rules evaluated against the updated plan.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

:::playground
---
title: Collection validation
base: /assets/playground/collection-validation/
entry: journey.ts
start: /collection-validation/overview
---
journey.ts
effects.ts
AnswerStore.ts
overview.ts
agree-plan.ts
manage-plan.ts
confirmation.ts
:::

:::note
---
---
The preview's storage is in memory. Restarting the preview or reloading the
guide page clears the draft and saved record.
:::

## How it works

`agree-plan.ts` puts three kinds of rule in the radio field's `validWhen`: the
answer is required, the plan needs an active goal, and each active goal needs
actions. `Iterator.Some` expresses the whole-collection check directly.

For the per-goal rules, `Iterator.Filter` selects active goals and `Iterator.Map`
creates a validation rule for each one. Each rule checks the length of that goal's
actions and uses `Format` with the goal title to explain what needs attention.
Future goals are excluded from this check rather than being reported as incomplete.

`manage-plan.ts` lets someone update actions, and `effects.ts` carries those edits
back into the plan. Returning to the agreement page evaluates the same rules
against the new values. Confirmation saves through `AnswerStore.ts` and clears
the draft.

## Adapting the pattern

Keep the aggregate rule as well as the per-item rules: mapping over an empty
collection would produce no item errors. The demo applies the plan rules to either
radio answer. If declining a plan should bypass them in your service, make that
condition explicit rather than relying on the wording of the question.
