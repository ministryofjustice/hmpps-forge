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

Load information before rendering a page when it comes from a service rather
than the user's answers. This example fetches a lottery draw and presents its
numbers through custom components.

## Try the pattern

1. Start the pattern to view a draw and its bonus ball.
2. Select **Draw again** to request another draw.
3. Edit the local lottery service or the draw's presentation, then run it again.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

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

## How it works

`journey.ts` runs `drawLotteryNumbers()` on access. The effect receives an injected
`LotteryService`, awaits a draw and puts the numbers, bonus ball and draw date into
`Data()`. The components in `draw.ts` read that data when Forge renders the page.

The effect coordinates the request, while the service supplies the draw. A real
integration can use the same arrangement to fetch reference data without turning
it into editable form answers.

**Draw again** links back to the draw page. That new request runs the access effect
again, rather than relying on a component to fetch data while rendering. Because
the effect is on the journey, it also runs when the overview is accessed.

:::note
---
---
The lottery service in this playground is a local simulation; it does not fetch
live draw results.
:::

## Adapting the pattern

Place an access effect at the scope that needs the data. A journey-level effect
suits data shared across its pages; a step-level effect avoids fetching it for
unrelated pages. If the values are fixed configuration, they may not need a fetch
at all.
