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

Ask for someone's name and role on separate pages, then let them review and change
their answers before confirming. Each question validates its answer before moving
on to the next page.

Edit the files below and select **Run** to try your changes. Drafts stay in the
preview session; confirmed answers go into a separate in-memory answer store.

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
