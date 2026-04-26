---
title: Shaping data for rendering
section: building-journeys
path: building-journeys/shaping-data
teaches: [derive-transformer, data-shaping, view-model, raw-data-to-render-model, inline-data-shaping]
prerequisites: [Data, pipe, Transformer, defineTransformerFunctions, access-patterns, createFunctionScope]
---

<p class="govuk-caption-xl">Working with data</p>

# Shaping data for rendering

Effects load raw data from APIs and data stores. Blocks render
components. Between the two sits a question: what happens when the
raw data does not match the shape a component expects?

{{slot:toc}}

---

## The problem

An effect loads case data from an API and exposes it through
`Data()`:

```typescript
LoadCaseData: (deps) => async (context, caseId: string) => {
  const caseData = await deps.caseApi.getCase(caseId)
  context.setData('case', caseData)
}
```

The API returns a nested structure:

```json
{
  "person": { "firstName": "Sam", "lastName": "Jones", "dateOfBirth": "1990-03-15" },
  "status": "ACTIVE",
  "riskLevel": "HIGH",
  "assignedOfficer": { "name": "Alex Smith", "team": "Probation - North" },
  "nextAppointment": "2026-05-01T10:30:00Z"
}
```

A summary list block needs rows with `key` and `value` objects. A
tag component needs a `text` and `classes` pair. A heading needs a
formatted full name. None of these match the API shape directly.

You could reach into the structure from blocks using `Data()` paths,
conditionals, and formatting:

```typescript
GovUKSummaryList({
  rows: [
    {
      key: { text: 'Name' },
      value: { text: Format('%1 %2', Data('case.person.firstName'), Data('case.person.lastName')) },
    },
    {
      key: { text: 'Status' },
      value: {
        html: when(Data('case.status').match(Condition.Equals('ACTIVE')))
          .then('<strong class="govuk-tag govuk-tag--green">Active</strong>')
          .else(
            when(Data('case.status').match(Condition.Equals('INACTIVE')))
              .then('<strong class="govuk-tag govuk-tag--grey">Inactive</strong>')
              .else('<strong class="govuk-tag govuk-tag--red">Archived</strong>'),
          ),
      },
    },
    {
      key: { text: 'Risk level' },
      value: { text: Data('case.riskLevel') },
    },
    {
      key: { text: 'Officer' },
      value: { text: Format('%1 (%2)', Data('case.assignedOfficer.name'), Data('case.assignedOfficer.team')) },
    },
    {
      key: { text: 'Next appointment' },
      value: { text: Data('case.nextAppointment').pipe(Transformer.Date.Format('d MMMM yyyy, h:mma')) },
    },
  ],
})
```

This works, but the block definition is now doing two jobs: it
declares the page structure and it reshapes the data. As the API
response grows, the block grows with it. The page structure gets
buried under data-shaping logic.

---

## Separating the concerns

The cleaner approach is to move the data shaping out of the block
and into a transformer. The block receives render-ready values.
The transformer handles the conversion:

```text
Effect            loads raw API data
Data()            exposes it to the step
Transformer       derives the render model
Block             declares the page structure
```

The block becomes a clean declaration of what the page looks like:

```typescript
export const caseSummary = GovUKSummaryList({
  rows: Data('case').pipe(CaseTransformers.ToCaseSummaryRows()),
})
```

The transformer contains the data-shaping logic:

```typescript
ToCaseSummaryRows: () => (value: unknown) => {
  const data = value as CaseData

  return [
    {
      key: { text: 'Name' },
      value: { text: `${data.person.firstName} ${data.person.lastName}` },
    },
    {
      key: { text: 'Status' },
      value: { html: statusTag(data.status) },
    },
    {
      key: { text: 'Risk level' },
      value: { text: data.riskLevel },
    },
    {
      key: { text: 'Officer' },
      value: { text: `${data.assignedOfficer.name} (${data.assignedOfficer.team})` },
    },
    {
      key: { text: 'Next appointment' },
      value: { text: formatDate(data.nextAppointment) },
    },
  ]
}
```

This is not domain logic pretending to be reusable application
logic. It is deliberately view-specific. It knows about summary
list rows, tag colours, date formatting, and whatever shape the
component expects. That is its job.

---

## When to reach for a transformer

Not every `Data()` reference needs a transformer. Simple cases
work well inline:

```typescript
GovUKHeading({ text: Data('case.person.firstName'), size: 'l' })

GovUKBody({ text: Data('case.description') })
```

A transformer becomes useful when:

- The raw data does not match the component props and needs
  restructuring (for example, API objects into summary list rows).
- The block contains deep nesting of `when().then().else()`,
  `Format()`, or `Data().path()` calls.
- Several component props are really part of the same render
  decision (for example, a tag's text, colour, and visibility all
  depend on the same status field).
- The step definition is starting to obscure the page structure
  under data-shaping logic.

---

## Writing derive transformers

A derive transformer converts raw data into a render-ready shape.
There are two ways to define one, depending on whether it is
shared or local.

### Shared transformers with defineTransformerFunctions

When a transformer is used across multiple steps or is complex
enough to warrant its own tests, use `defineTransformerFunctions`.
See [Custom transformers](../building-functions-and-components/custom-transformers)
for the full pattern.

```typescript
import { defineTransformerFunctions } from '@ministryofjustice/hmpps-forge/core/authoring'

export const { transformers: CaseTransformers, implementations: caseTransformerImplementations } =
  defineTransformerFunctions<CaseTransformerShape>({
    ToCaseSummaryRows: () => (value: unknown) => {
      const data = value as CaseData

      return [
        { key: { text: 'Name' }, value: { text: `${data.person.firstName} ${data.person.lastName}` } },
        { key: { text: 'Status' }, value: { html: statusTag(data.status) } },
      ]
    },
  })
```

### Inline transformers with createFunctionScope

When a transformer only serves one block, define it inline using a
function scope. See [Inlining functions](../building-functions-and-components/inline-functions)
for the full API.

```typescript
import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKSummaryList } from '@ministryofjustice/hmpps-forge/govuk-components'
import { MyFunctions } from '../../functions'

export const caseSummary = GovUKSummaryList({
  rows: Data('case').pipe(
    MyFunctions.transformer('ToCaseSummaryRows', () => (value: unknown) => {
      const data = value as CaseData

      return [
        { key: { text: 'Name' }, value: { text: `${data.person.firstName} ${data.person.lastName}` } },
        { key: { text: 'Status' }, value: { html: statusTag(data.status) } },
      ]
    }),
  ),
})
```

Both approaches go through the same registry and evaluation
pipeline. The choice is about where the code lives, not how it
runs.

---

## Keeping responsibilities clear

Each layer in the pipeline has a single job:

```text
Effects           fetch, save, call APIs, write request data
Data              store raw request-time data
Transformers      convert raw data into render-ready values
Blocks            declare and render the page structure
```

Effects should not format data for display. Transformers should
not call APIs or mutate context. Blocks should not contain
branching logic to reshape data structures.

Repeated evaluation is acceptable. Transformers run at render time
on every request, but they are not doing IO. They take a value and
return a new value. The cost is negligible compared to the API
call that loaded the data in the first place.

---

## Best practices

- **Start inline, extract when needed.** Begin with `Data()` paths
  and simple `.pipe()` calls in blocks. When the block definition
  starts to obscure the page structure, move the shaping logic into
  a transformer.
- **Keep transformers view-specific.** A transformer that returns
  summary list rows knows about `key` and `value` objects. That is
  fine. It is a view concern, not domain logic.
- **Do not reshape data in effects.** Effects load and save. If an
  API response needs restructuring for a component, that is a
  transformer's job. Mixing the two makes effects harder to test
  and ties them to specific component shapes.
- **Name transformers after the output shape.** `ToCaseSummaryRows`
  describes what comes out. `ProcessCaseData` does not.
- **Validate the input type.** Transformer inputs are `unknown`.
  Verify the type before operating on the value and throw
  `TypeError` for mismatches.
