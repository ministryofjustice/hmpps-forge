---
title: Creating your own custom generator
slug: creating-your-own-custom-generator
section: how-to-guides
path: how-to-guides/creating-your-own-custom-generator
nav: Extending Forge/Functions
order: 4
description: Create, configure, and use a generator for an application-specific value
teaches: [generator, custom-generators, expressions, outputSchema, argumentsSchema, dependencies]
prerequisites: [generator, how-expressions-work, create-forge-package]
related:
  concept: how-expressions-work, packaging-journeys-into-an-app
  how-to: testing-a-function
  reference: generator
---

# Creating your own custom generator

Some page values don't live neatly in one answer or one piece of loaded data. A heading
like `Open safeguarding case SC-1042` has to be built from several smaller values, plus
the wording and formatting that make sense to your service. A custom generator gives
that work a name and leaves the journey with one readable expression.

In this guide, we'll create a generator that builds that case heading, use it on a page,
then add schemas, configuration, and an application dependency.

## Start with the value your page needs

Imagine a case overview page whose heading needs the case status, type, and number:

```typescript
const caseOverviewStep = step({
  path: '/case-overview',
  title: 'Case overview',
  blocks: [
    GovUKHeading({
      text: 'Case overview',
      size: 'l',
    }),
  ],
})
```

The placeholder works, but it doesn't tell somebody which case they're looking at. The
answers already contain the pieces:

```typescript
Answer('caseStatus')
Answer('caseType')
Answer('caseNumber')
```

No single expression contains the finished heading, but a generator can build one from
those three values.

## Create the generator

Here is the generator:

```typescript [[1, 3, "generator('Case.BuildCaseHeading'"], [2, 5, "status: string"], [2, 6, "caseType: string"], [2, 7, "caseNumber: string"], [3, 12, "return"]]
import { generator } from '@ministryofjustice/hmpps-forge/core/authoring'

const BuildCaseHeading = generator('Case.BuildCaseHeading', {
  factory: () => (
    status: string,
    caseType: string,
    caseNumber: string,
  ) => {
    const readableStatus = status.toLowerCase()
    const readableType = caseType.toLowerCase()

    return `${readableStatus} ${readableType} case ${caseNumber}`
  },
})
```

The <s1>`generator()` call</s1> gives the function a name and creates a
`BuildCaseHeading` entry that the journey can use. When you use it in a journey
definition, it registers itself automatically - no registry or `functions` listing needed.

Unlike a transformer or condition, a generator doesn't receive a separate input value
from a pipeline or match. Every value from the expression arrives through its
<s2>authored arguments</s2>, resolved from the current request, and the generator returns the value the
expression should produce. Application collaborators can also arrive through injected
dependencies, which we'll add later.

## Use the generator on your page

Now replace the placeholder heading with the generator:

```typescript [[8, 6, "BuildCaseHeading("], [2, 7, "Answer('caseStatus')"], [2, 8, "Answer('caseType')"], [2, 9, "Answer('caseNumber')"]]
const caseOverviewStep = step({
  path: '/case-overview',
  title: 'Case overview',
  blocks: [
    GovUKHeading({
      text: BuildCaseHeading(
        Answer('caseStatus'),
        Answer('caseType'),
        Answer('caseNumber'),
      ),
      size: 'l',
    }),
  ],
})
```

The <s8>generator expression</s8> sits where the heading text would otherwise go. Each
<s2>`Answer()` reference</s2> resolves first, then the generator runs with the concrete
values.

For answers of `OPEN`, `SAFEGUARDING`, and `SC-1042`, the page now displays:

```text
open safeguarding case SC-1042
```

That's the core workflow complete: the function is created and producing a value on the
page.

Keep the references in the definition, as they are above. Calling `Answer()` inside the
generator would create an authoring object rather than read an answer; registered
functions work with the resolved values passed to them.

## Describe the arguments and result

The generator expects three strings and produces another string. Describe those
boundaries with schemas:

```typescript [[1, 3, "generator('Case.BuildCaseHeading'"], [4, 4, "argumentsSchema"], [5, 9, "outputSchema: z.string()"], [2, 11, "status: string"], [2, 12, "caseType: string"], [2, 13, "caseNumber: string"], [3, 18, "return"]]
import { z } from 'zod'

const BuildCaseHeading = generator('Case.BuildCaseHeading', {
  argumentsSchema: z.tuple([
    z.string(),
    z.string(),
    z.string(),
  ]),
  outputSchema: z.string(),
  factory: () => (
    status: string,
    caseType: string,
    caseNumber: string,
  ) => {
    const readableStatus = status.toLowerCase()
    const readableType = caseType.toLowerCase()

    return `${readableStatus} ${readableType} case ${caseNumber}`
  },
})
```

The <s4>arguments schema</s4> describes the arguments authored in the definition and
checks their resolved values before the generator runs. If one is missing or isn't a
string, the invalid argument is reported instead of calling the function with a value
it doesn't understand.

The <s5>output schema</s5> checks the generated value. If a later change returns
something other than a string, that invalid result is reported at the function
boundary.

Generators have no `inputSchema`: there is no separate pipeline or matched runtime value
to describe. Expression values are supplied through their authored arguments instead.

## Pass configuration to the generator

Suppose another page needs a shorter heading without the status. We can configure the
same generator with a display style rather than creating a second one:

```typescript [[4, 4, "argumentsSchema"], [6, 8, "z.enum(['full', 'compact'])"], [2, 12, "status: string"], [2, 13, "caseType: string"], [2, 14, "caseNumber: string"], [6, 15, "style: HeadingStyle"], [6, 17, "if (style === 'compact')"], [3, 21, "return"]]
type HeadingStyle = 'full' | 'compact'

const BuildCaseHeading = generator('Case.BuildCaseHeading', {
  argumentsSchema: z.tuple([
    z.string(),
    z.string(),
    z.string(),
    z.enum(['full', 'compact']),
  ]),
  outputSchema: z.string(),
  factory: () => (
    status: string,
    caseType: string,
    caseNumber: string,
    style: HeadingStyle,
  ) => {
    if (style === 'compact') {
      return `${caseType.toLowerCase()} case ${caseNumber}`
    }

    return `${status.toLowerCase()} ${caseType.toLowerCase()} case ${caseNumber}`
  },
})
```

Choose the <s6>style</s6> where the page uses the generator:

```typescript [[8, 1, "BuildCaseHeading("], [6, 5, "'full'"]]
text: BuildCaseHeading(
  Answer('caseStatus'),
  Answer('caseType'),
  Answer('caseNumber'),
  'full',
),
```

The first three arguments resolve from the current answers. The definition
supplies `'full'` directly, and it arrives as the final argument. A compact page can pass
`'compact'` instead.

:::note
---
---
When a generator starts collecting lots of parameters, a single configuration object
can be much nicer to work with - especially when some of its options are optional.
:::

## Use a dependency in your generator

The generator currently owns the words used for every case type. Suppose your
application already has a `caseLabelService` that provides the approved display label
for each type. Inject that service rather than duplicating its mapping:

```typescript [[7, 2, "labelFor"], [7, 6, "caseLabelService: CaseLabelService"], [1, 9, "generator('Case.BuildCaseHeading'"], [7, 17, "factory: (deps: CaseDeps) => async"], [2, 18, "status: string"], [2, 19, "caseType: string"], [2, 20, "caseNumber: string"], [6, 21, "style: HeadingStyle"], [7, 23, "deps.caseLabelService.labelFor(caseType)"]]
interface CaseLabelService {
  labelFor(caseType: string): Promise<string>
}

interface CaseDeps {
  caseLabelService: CaseLabelService
}

const BuildCaseHeading = generator('Case.BuildCaseHeading', {
  argumentsSchema: z.tuple([
    z.string(),
    z.string(),
    z.string(),
    z.enum(['full', 'compact']),
  ]),
  outputSchema: z.string(),
  factory: (deps: CaseDeps) => async (
    status: string,
    caseType: string,
    caseNumber: string,
    style: HeadingStyle,
  ) => {
    const caseTypeLabel = await deps.caseLabelService.labelFor(caseType)

    if (style === 'compact') {
      return `${caseTypeLabel} case ${caseNumber}`
    }

    return `${status.toLowerCase()} ${caseTypeLabel} case ${caseNumber}`
  },
})
```

The <s7>`deps` object</s7> gives the generator its case-label service. Because the lookup
is asynchronous, the generator returns a promise; evaluation waits for it and then checks the
resolved string against the output schema.

Supply the service when the application registers the package:

```typescript [[7, 2, "caseLabelService: services.caseLabelService"]]
forge.registerPackage(casePackage, {
  caseLabelService: services.caseLabelService,
})
```

That completes the dependency wiring. The page still uses
`BuildCaseHeading(...)`; only the generator knows where its approved case
label comes from.

## See how the generator parts fit together

You've now used every part of a generator function. Its complete shape is:

```text [[7, 1, "deps"], [2, 1, "...arguments"], [5, 1, "value | Promise<value>"]]
deps => (...arguments) => value | Promise<value>
```

The outer function receives your application's <s7>dependencies</s7>. The inner function
receives the <s2>resolved arguments</s2> authored in the definition and returns the
<s5>generated value</s5>, either immediately or in a promise.

Simple generators don't need every part of that shape. A generator can take no
arguments, like one that produces the current date, and it can ignore dependencies when
plain calculation is enough.

Before reusing the generator across more pages, test its full and compact results.
[Testing a function](./testing-a-function) shows how to evaluate a generator directly;
generators return their result without a `withInput()` call.

## Recap

You now have a named expression that builds a case heading from resolved answers and
application-owned labelling.

Let's recap the key points.

- Define custom generators with `generator()` and give each one a name.
- Pass references and configuration through the generator's authored arguments.
- Use an `argumentsSchema` to describe those arguments and an `outputSchema` to describe
  the generated value.
- Keep `Answer()`, `Data()`, and other authoring references in definitions, where they
  can be resolved.
- Inject application services through dependencies when generation needs them.
- Test generators by evaluating their handles directly, without `withInput()`.
