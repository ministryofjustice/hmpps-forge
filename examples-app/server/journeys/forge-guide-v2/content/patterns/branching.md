---
title: Branching
slug: branching
section: patterns
path: patterns/branching
order: 1
description: Try a journey with three branches, validation and a shared answer summary
---

# Branching

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
overview/step.ts
visit-type/step.ts
location/step.ts
video-email/step.ts
phone-number/step.ts
phone-number/conditions.ts
check-answers/step.ts
confirmation/step.ts
:::
