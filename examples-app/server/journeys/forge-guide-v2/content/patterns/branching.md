---
title: Branching based on an earlier answer
slug: branching
section: patterns
path: patterns/branching
nav: Input and forms
order: 2
description: Try a journey with three branches, validation and a shared answer summary
---

# Branching based on an earlier answer

Ask a question once, then collect only the details needed for the chosen answer.
This example offers an in-person meeting, video call or phone call. Each option
has its own follow-up page before the branches meet at a shared summary.

## Try the pattern

1. Start the pattern and choose a video call. Leave the email empty to try its validation.
2. Complete the details, then change the meeting choice from the summary to a phone call.
3. Enter a phone number and check that the summary shows the details for that choice.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

:::playground
---
title: Branching
base: /assets/playground/branching/
entry: journey.ts
start: /branching/overview
---
journey.ts
effects.ts
AnswerStore.ts
overview.ts
visit-type.ts
location.ts
video-email.ts
phone-number.ts
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

`visit-type.ts` defines a conditional redirect for each of the three options.
After a valid submission, Forge follows the redirect whose condition matches
`Answer('visitType')`. Each follow-up step collects its own answer and redirects
to `check-answers.ts`.

The summary uses the same choice to control which rows are visible. Routing and
presentation therefore agree about which details matter. Changing the choice
makes the new branch relevant; it does not automatically erase answers from a
previous branch.

`effects.ts` keeps draft answers in the preview session. Confirmation saves a
separate record through `AnswerStore.ts`, clears the draft and uses
`Data('savedAnswers')` to make the confirmation page available.

## Adapting the pattern

When an answer changes, decide whether to retain the old branch's answers for a
possible return or explicitly clear them. If the follow-up is just a short detail
on the same page, [Reveal fields](/forge-guide-v2/patterns/reveal-fields) may be a
better fit.
