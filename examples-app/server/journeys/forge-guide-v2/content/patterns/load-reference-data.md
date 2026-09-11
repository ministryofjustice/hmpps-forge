---
title: Load reference data on access
slug: load-reference-data
section: patterns
path: patterns/load-reference-data
nav: Data and integrations
order: 10
description: Load fresh reference data from a service before rendering the page.
---

# Load reference data on access

An access effect calls a simulated lottery service before the page renders.
Select **Draw again** to fetch a new set of numbers. The component reads the
loaded values through `Data()` expressions.

Edit the files below and select **Run** to try your changes.

:::playground
---
title: Load reference data
base: /assets/playground/load-reference-data/
entry: journey.ts
start: /load-reference-data/overview
---
journey.ts
effects.ts
LotteryService.ts
overview.ts
draw.ts
lotteryBall.ts
:::
