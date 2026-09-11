---
title: Shaping data inline
slug: inline-functions
section: patterns
path: patterns/inline-functions
nav: Data and integrations
order: 12
description: Compare chained expressions with inline transformers that shape the same case data.
---

# Shaping data inline

Compare two versions of a case overview. Both show the same risk scores, sentence,
goals and attendance. The first uses chained expressions; the second uses inline
transformers to keep the presentation logic together. An effect supplies simulated
case data for both pages.

Edit the files below and select **Run** to try your changes.

:::playground
---
title: Inline functions
base: /assets/playground/inline-functions/
entry: journey.ts
start: /inline-functions/overview
---
journey.ts
effects.ts
overview.ts
before.ts
after.ts
:::
