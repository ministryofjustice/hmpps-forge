---
title: Shaping loaded data for a component
slug: shaping-loaded-data-for-a-component
section: how-to-guides
path: how-to-guides/shaping-loaded-data-for-a-component
nav: Loading and saving data
order: 8
description: Turn a loaded case record into summary list rows while keeping the page definition readable
teaches: [data-shaping, Data, transformer, pipe, component-props, inputSchema]
prerequisites: [loading-data-for-use-in-your-steps, how-expressions-work]
related:
  concept: [how-expressions-work, how-blocks-resolution-and-rendering-connect]
  how-to: [creating-your-own-custom-transformer, testing-a-function, handling-missing-data-and-service-failures]
  reference: [data, transformer]
---

# Shaping loaded data for a component

The case is loaded, and all the information we need is there. But it doesn't quite look
like the page we want. Names arrive in separate fields, statuses arrive as codes, and a
summary list expects rows rather than a case record.

We'll build on the case overview from [Loading data for use in your
steps](./loading-data-for-use-in-your-steps). We'll start with values the page can read,
then give the work of turning a case into summary rows its own name.

## Start with the summary you want to show

Our overview needs three rows:

| | |
|---|---|
| Person | Sam Jones |
| Status | Active |
| Officer | Alex Smith |

We can build that summary with hardcoded values first. Add this block to the overview
step's `blocks` array:

```typescript [[1, 4, "rows:"], [1, 5, "key: { text: 'Person' }, value: { text: 'Sam Jones' }"]]
import { GovUKSummaryList } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKSummaryList({
  rows: [
    { key: { text: 'Person' }, value: { text: 'Sam Jones' } },
    { key: { text: 'Status' }, value: { text: 'Active' } },
    { key: { text: 'Officer' }, value: { text: 'Alex Smith' } },
  ],
})
```

The <s1>rows</s1> describe what the component needs: a label in `key.text` and a value
in `value.text`. Open the overview and check that the summary has the labels and order
we want.

Now compare that with the record our case service returns:

```json
{
  "reference": "C12345",
  "person": {
    "firstName": "Sam",
    "lastName": "Jones"
  },
  "status": "ACTIVE",
  "assignedOfficer": {
    "name": "Alex Smith"
  }
}
```

The loader from the loading guide stores this record with `context.setData('case', caseRecord)`.
Keep that effect and its access hook. The work we're adding starts once the case is available.

## Read values that already fit

Some values need no reshaping at all. The case reference can become the heading, and the
officer's name can fill a summary value:

```typescript [[2, 5, "Data('case.reference')"], [2, 13, "Data('case.assignedOfficer.name')"]]
import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading } from '@ministryofjustice/hmpps-forge/govuk-components'

GovUKHeading({
  text: Data('case.reference'),
  size: 'l',
})

GovUKSummaryList({
  rows: [
    {
      key: { text: 'Officer' },
      value: { text: Data('case.assignedOfficer.name') },
    },
  ],
})
```

Each <s2>`Data()` path</s2> reads a value from the loaded record. Try these blocks on the
overview: the heading shows `C12345`, and the officer row shows Alex Smith.

There's no need for a transformer when the value already fits the prop. We can keep the
heading exactly like this.

The full summary needs more work. We want to join the person's names, turn `ACTIVE` into
`Active`, and show “Not assigned” when no officer exists. Those decisions belong together,
so let's give them one place to live.

## Turn the case into rows

Create `caseSummary.ts` alongside the overview definition. We'll describe the case values
our summary uses, then return the rows the component expects:

```typescript [[3, 4, "caseSummaryInputSchema"], [3, 15, "z.infer<typeof caseSummaryInputSchema>"], [4, 17, "transformer('Cases.ToCaseSummaryRows'"], [3, 18, "inputSchema: caseSummaryInputSchema"], [2, 19, "caseRecord: CaseRecord"], [1, 25, "return ["], [5, 36, "caseRecord.assignedOfficer?.name ?? 'Not assigned'"]]
import { z } from 'zod'
import { transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

const caseSummaryInputSchema = z.object({
  person: z.object({
    firstName: z.string(),
    lastName: z.string(),
  }),
  status: z.enum(['ACTIVE', 'CLOSED']),
  assignedOfficer: z.object({
    name: z.string(),
  }).optional(),
})

type CaseRecord = z.infer<typeof caseSummaryInputSchema>

export const ToCaseSummaryRows = transformer('Cases.ToCaseSummaryRows', {
  inputSchema: caseSummaryInputSchema,
  factory: () => (caseRecord: CaseRecord) => {
    const statusLabels = {
      ACTIVE: 'Active',
      CLOSED: 'Closed',
    }

    return [
      {
        key: { text: 'Person' },
        value: { text: `${caseRecord.person.firstName} ${caseRecord.person.lastName}` },
      },
      {
        key: { text: 'Status' },
        value: { text: statusLabels[caseRecord.status] },
      },
      {
        key: { text: 'Officer' },
        value: { text: caseRecord.assignedOfficer?.name ?? 'Not assigned' },
      },
    ]
  },
})
```

The <s3>input schema</s3> describes the values this summary needs. `CaseRecord` uses that
same shape for TypeScript, and Forge checks the input before calling the evaluator.
An unexpected status code fails that check instead of producing a misleading label.

The <s4>transformer</s4> receives the <s2>loaded case</s2> and returns new <s1>rows</s1>.
It joins the names, chooses a status label, and supplies <s5>fallback text</s5> for an
unassigned officer. It leaves the original case record untouched.

`ToCaseSummaryRows` names the result we want. This function knows about summary list
labels and row shapes because that is the job we're giving it.

## Pass the rows to the component

Replace the summary block's hardcoded rows with a pipeline:

```typescript [[1, 4, "rows:"], [2, 4, "Data('case')"], [6, 4, ".pipe"], [4, 4, "ToCaseSummaryRows()"]]
import { ToCaseSummaryRows } from './caseSummary'

GovUKSummaryList({
  rows: Data('case').pipe(ToCaseSummaryRows()),
})
```

The <s6>pipeline</s6> reads the <s2>case</s2>, passes it into the <s4>transformer</s4>,
and uses the returned <s1>rows</s1> as the component prop. Forge resolves this expression
before the component renders, so the component receives ordinary row values.

Open `/cases/C12345/overview` again. The summary now shows Sam Jones, Active, and Alex
Smith using the loaded record. The heading still reads `Data('case.reference')` because
that value needs no transformation.

When `createForgePackage()` collects this journey, it also collects the transformer used
in the pipeline. Our existing package setup can stay as it is.

The access effect still loads the case. The transformer prepares its display values,
and the component renders them. Another step can read the original status code from
`Data('case.status')` without receiving our display label instead.

## Check the other case states

Let's check the choices the transformer makes. In the case service fixture, change
`status` to `"CLOSED"` and remove `assignedOfficer`, then reload the overview.

The status row now shows “Closed”, and the officer row shows <s5>“Not assigned”</s5>.
The person row stays the same. Restore the officer and check that their name returns.

These are also useful cases for a transformer test. [Testing a
function](./testing-a-function) shows how to supply a record and inspect the returned rows
without loading a page.

A missing officer is different from a missing case. If `Data('case')` is absent, Forge
skips the transformer, so its fallback text never runs. Handle a missing case in the
access hook, as shown in [Handling missing data and service
failures](./handling-missing-data-and-service-failures).

## Recap

Our summary now uses the loaded case while keeping its display decisions together.

Let's recap the key points.

- Start with the shape the component needs.
- Use `Data()` paths when loaded values already fit the props.
- Give related display decisions a named transformer when they start to crowd the block.
- Describe the transformer's input with a schema and return new values without changing the loaded record.
- Pass the transformed value into the component with `.pipe()`.
- Keep loading in the access effect, and handle missing records before the page renders.
