---
title: Resuming a partially-completed journey
slug: resuming
section: patterns
path: patterns/resuming
nav: Entry and routing
order: 5
description: Return to the next unanswered question in a partially completed journey
---

# Resuming a partially-completed journey

Let someone continue at the next question they need to complete. This example
uses saved draft answers and Forge's resume behaviour to choose a destination,
instead of recording a last-visited question.

## Try the pattern

1. Select **Seed partial progress**, then **Continue where you left off**.
2. Return to the overview and seed complete progress to compare the destination.
3. Clear the saved answers and start normally to follow the whole question sequence.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

:::playground
---
title: Resuming
base: /assets/playground/resuming/
entry: journey.ts
start: /resuming/overview
---
journey.ts
effects.ts
AnswerStore.ts
overview.ts
your-name.ts
your-role.ts
check-answers.ts
confirmation.ts
:::

:::note
---
---
The preview's storage is in memory: reloading the guide page or restarting the
preview removes it, including the seeded progress. The demo does not provide
durable storage or identify returning users.
:::

## How it works

`journey.ts` enables resume when `Query('resume')` equals `'true'`. The overview's
continue link adds that query parameter to the journey root. Ordinary question
and change links do not request resume, so someone can still visit an earlier
question deliberately.

Before Forge evaluates the journey, `loadDraftAnswers()` restores the draft.
Forge then uses the route through the question steps and their validation to
find where to continue. The seed buttons in `overview.ts` provide partial and
complete drafts so you can exercise this without repeatedly filling in the form.

Completed submissions are saved separately through `AnswerStore.ts`. The
confirmation page depends on that saved record rather than draft answers that
have already been cleared.

## Adapting the pattern

In a service, load the draft belonging to the returning user or application
before resume runs. This demo shows how to choose the next page once those answers
are available.
