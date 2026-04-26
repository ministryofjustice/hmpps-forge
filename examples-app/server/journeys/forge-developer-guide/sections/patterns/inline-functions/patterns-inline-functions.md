---
title: Shaping data inline
section: patterns
path: patterns/inline-functions
teaches: [inline-function-pattern, scoped-transformer, scoped-condition, data-shaping-pattern, derive-transformer]
prerequisites: [createFunctionScope, Data, pipe, match-method, defineTransformerFunctions]
---

<p class="govuk-caption-xl">Data and integrations</p>

# Shaping data inline

When an effect loads structured data from an API or data store,
the block definition often needs to reshape it before rendering.
Rather than scattering `when().then().else()` chains and deep
`Data()` paths across the block, you can use `createFunctionScope`
to define small transformers and conditions right where they are
used.

This pattern keeps the effect focused on loading, keeps the block
focused on page structure, and puts the data-shaping logic in a
named, testable unit that lives at the call site.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/inline-functions" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## The problem

Consider a case overview page. The effect loads a nested object
with risk scores, goals, and compliance data. The block needs to
render each risk score as a coloured tag, compute goal progress,
and calculate a compliance percentage.

Using expressions alone, every risk score needs a
`when().then().else()` chain for both its text and its colour.
Six risk areas means twelve chains of identical logic. Goal counts
and percentages cannot be computed in expressions at all, so the
effect has to pre-compute them. The block definition grows long
and repetitive, and the page structure gets buried under
data-shaping logic.

---

## The solution

With `createFunctionScope`, the repeated logic collapses into a
single inline transformer. A reusable helper function calls the
same transformer for each risk area, and the scope deduplicates
the registration:

```typescript
const riskRow = (area: string, ref: ReturnType<typeof Data>) => ({
  key: { text: area },
  value: {
    html: ref.pipe(
      MyFunctions.transformer('RiskLevelTag', () => (value: unknown) => {
        const config: Record<string, { text: string; colour: string }> = {
          VERY_HIGH: { text: 'Very high', colour: 'red' },
          HIGH: { text: 'High', colour: 'red' },
          MEDIUM: { text: 'Medium', colour: 'yellow' },
          LOW: { text: 'Low', colour: 'green' },
        }
        const { text, colour } = config[value as string] ?? { text: String(value), colour: 'grey' }

        return `<strong class="govuk-tag govuk-tag--${colour}">${text}</strong>`
      }),
    ),
  },
})

export const riskScores = GovUKSummaryList({
  rows: [
    riskRow('Overall', Data('case.riskScores.overall')),
    riskRow('Self-harm', Data('case.riskScores.selfHarm')),
    riskRow('Public protection', Data('case.riskScores.publicProtection')),
    riskRow('Known adult', Data('case.riskScores.knownAdult')),
    riskRow('Children', Data('case.riskScores.children')),
    riskRow('Staff', Data('case.riskScores.staff')),
  ],
})
```

Goals and compliance summaries that the effect had to pre-compute
become inline transformers that derive from the raw data:

```typescript
export const goalsSummary = GovUKBody({
  text: Data('case.goals').pipe(
    MyFunctions.transformer('GoalsSummary', () => (value: unknown) => {
      const goals = value as CaseGoal[]
      const achieved = goals.filter(g => g.status === 'ACHIEVED').length

      return `${achieved} of ${goals.length} goals achieved`
    }),
  ),
})
```

---

## What the demo shows

The interactive demo renders the same case overview dashboard
twice. Both pages produce identical output from the same data.
Compare the code panels to see the difference:

- The **verbose version** uses `when().then().else()` chains
  repeated for all 6 risk scores, and relies on pre-computed
  values from the effect for goals and compliance
- The **clean version** uses a `riskRow()` helper backed by one
  inline transformer, and derives goals and compliance summaries
  directly from the raw data

{{slot:demo}}

---

## Best practices

- **Keep inline functions short.** If a transformer grows beyond
  10 to 15 lines, extract it into a `defineTransformerFunctions`
  file with its own tests.
- **Name functions after the output.** `RiskLevelTag` and
  `GoalsSummary` describe what they produce.
- **One scope per package.** Create it in a shared file, import
  it into blocks. All inline functions flow through a single
  collector for registration.
- **Do not reshape data in effects.** Effects load and save.
  Transformers reshape. Mixing the two ties effects to specific
  component shapes and makes them harder to test.
