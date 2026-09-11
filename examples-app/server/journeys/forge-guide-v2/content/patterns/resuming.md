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

Save some draft answers, then return to the journey with resume enabled. Forge
finds the next question that still needs an answer. Once every question is
complete, resume takes you to the summary for confirmation.

Use the example's seed buttons to try different starting points. Drafts stay in
the preview session; confirmed answers go into a separate in-memory answer store.
Edit the files below and select **Run** to try your changes.

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
