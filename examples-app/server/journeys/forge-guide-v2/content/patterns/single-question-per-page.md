---
title: Single question per page
slug: single-question-per-page
section: patterns
path: patterns/single-question-per-page
nav: Input and forms
order: 1
description: Try a sequential journey with validation and a shared answer summary
---

# Single question per page

Give each question its own page when someone needs to focus on one decision at a time.
This example collects a name and role, checks each answer before moving on, then
shows a summary for review.

## Try the pattern

1. Start the pattern and continue without a name to see the validation message.
2. Enter a name and role, then use a change link on the summary to revisit a question.
3. Confirm the answers and compare the confirmation with the editable summary.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

:::playground
---
title: Single question per page
base: /assets/playground/single-question-per-page/
entry: journey.ts
start: /single-question-per-page/overview
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
The preview's session and answer store both live in memory and are lost when the
preview restarts or the guide page reloads.
:::

## How it works

`your-name.ts` and `your-role.ts` each define a field, its validation and the next
step. The question is also the field's label or legend, so the page heading and
input describe the same task. A successful submission saves the draft before
redirecting to the next question.

`check-answers.ts` reads those answers into a summary list. Its change links lead
back to the question pages, which load the existing values into their inputs.
These are ordinary links: after an edit, the user follows the question sequence
again.

On confirmation, `effects.ts` saves a separate record in `AnswerStore.ts` and
clears the draft. `confirmation.ts` uses the saved record to decide whether the
page is available, so clearing the draft does not make confirmation unreachable.

## Adapting the pattern

Keep closely related inputs together when they form one answer, such as a date.
For edits that should return straight to the summary, see
[Edit and return](/forge-guide-v2/patterns/edit-and-return).
