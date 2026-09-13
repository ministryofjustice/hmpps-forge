---
title: Edit and return
slug: edit-and-return
section: patterns
path: patterns/edit-and-return
nav: Entry and routing
order: 7
description: Collect contact details, then use change links to edit one answer and return directly to the summary.
---

# Edit and return

Let someone change an answer from a summary and return directly to the review.
The same question pages still work in their normal order when first completing
the journey.

## Try the pattern

1. Complete the questions and select a change link on the summary.
2. Clear the required answer and continue to see validation on the edit page.
3. Enter a valid answer and continue straight back to the summary.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

:::playground
---
title: Edit and return
base: /assets/playground/edit-and-return/
entry: journey.ts
start: /edit-and-return/overview
---
journey.ts
effects.ts
AnswerStore.ts
overview.ts
full-name.ts
email-address.ts
contact-preference.ts
check-answers.ts
confirmation.ts
:::

:::note
---
---
The preview keeps draft answers and saved records in memory. Restarting the
preview or reloading the guide page clears both.
:::

## How it works

`check-answers.ts` adds `?returnTo=check-answers` to its change links. Each question
step saves a valid edit, then checks `Query('returnTo')` when choosing its next
redirect. If the value is `'check-answers'`, it returns to that fixed step;
otherwise it follows the normal question sequence.

The return instruction survives the form submission, so an invalid edit can show
errors and still return to the summary once corrected. Both routes use the same
fields, validation and save effects. There is no second copy of the question just
for editing.

The demo checks a known return value and redirects to a known destination. It does
not use arbitrary query text as a redirect URL. Drafts stay in the preview session;
confirmation saves a separate record through `AnswerStore.ts`.

## Adapting the pattern

Returning directly is appropriate when the edited answer does not introduce more
questions. If it changes a branch or invalidates later answers, route through the
affected questions before returning to review. See
[Branching](/forge-guide-v2/patterns/branching) for an example.
