---
title: Reveal fields
slug: reveal-fields
section: patterns
path: patterns/reveal-fields
nav: Input and forms
order: 3
description: Reveal a follow-up question when someone selects an option, and validate only the fields that apply.
---

# Reveal fields

Reveal a short follow-up beside the answer that makes it relevant. This example
asks how someone heard about a service: social media needs a platform name, while
“Other” needs a description.

## Try the pattern

1. Choose social media and continue without naming a platform.
2. Enter a platform, then switch to an option with no follow-up and continue.
3. Change the answer to “Other” and check which details appear on the summary.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

:::playground
---
title: Reveal fields
base: /assets/playground/reveal-fields/
entry: journey.ts
start: /reveal-fields/overview
---
journey.ts
effects.ts
AnswerStore.ts
overview.ts
heard-from.ts
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

`heard-from.ts` attaches a text input to each radio option that needs more detail.
Each input also has a `dependentWhen` condition matching that option. The radio
component reveals the attached content, while the dependency tells Forge when
the field applies.

The parent question and follow-up fields have their own required validation.
Someone choosing social media must supply a platform; someone choosing an option
without a follow-up can continue without filling that field.

`check-answers.ts` uses conditional rows to show the selected answer and its
relevant detail. Drafts stay in the preview session until confirmation saves a
separate record through `AnswerStore.ts`.

## Adapting the pattern

Use a reveal for a small amount of closely related information. Use
[Branching](/forge-guide-v2/patterns/branching) when an option needs its own sequence
of questions. A hidden field is not a request to delete its previous value;
add that behaviour explicitly if the service needs it.
