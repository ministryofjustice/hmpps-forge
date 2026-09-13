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

Keep a small presentation transformation close to the component that uses it.
This example shows the same case overview in two forms: repeated expressions in
the “before” step and inline transformers in the “after” step. Neither page needs
a form to make use of Forge.

## Try the pattern

1. Open the verbose version, then switch to the version with inline transformers.
2. Compare the risk labels, goals total and attendance rate across the two pages.
3. Change a label or the attendance formatting in `after.ts`, then run the example again.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

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

## How it works

`before.ts` repeats conditional HTML for each risk score and reads precomputed
summary values from the access effect. `after.ts` keeps the same six explicit risk
rows, but uses a `riskRow` helper to share their presentation.

That helper accepts a `Resolvable<string>`, allowing each caller to pass a data
reference. `Literal(riskLevel).pipe(...)` supplies the resolved string to an inline
transformer, which chooses a label and colour from a small lookup. An unrecognised
level falls back to “Unknown”. The HTML is built from those known labels and
colours rather than inserting the original value into markup.

The goals and compliance components also use inline transformers, with ordinary
TypeScript types for the values their callbacks receive. They calculate the
summary from `Data('case.goals')` and `Data('case.compliance')` beside the text that
displays it. `loadCaseOverview()` still provides data for both versions, including
the precomputed values used by the before step.

## Adapting the pattern

Choose the form that makes the transformation easiest to read. A short lookup or
calculation can be clearer here than a long expression chain; built-in expressions
remain useful for straightforward operations. Extract logic when it is shared or
obscures the component, rather than moving it solely because it is JavaScript.
