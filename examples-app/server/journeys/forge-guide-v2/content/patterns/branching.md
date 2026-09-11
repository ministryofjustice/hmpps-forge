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

Ask how someone would like to meet, then collect the details for their chosen option.
The three branches come together on a check-your-answers page, where they can change
their choices before confirming.

Edit the files below and select **Run** to try your changes. Drafts stay in the
preview session; confirmed answers go into a separate in-memory answer store.

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
