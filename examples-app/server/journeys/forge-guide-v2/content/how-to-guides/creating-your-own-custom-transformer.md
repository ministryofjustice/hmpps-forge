---
title: Creating your own custom transformer
slug: creating-your-own-custom-transformer
section: how-to-guides
path: how-to-guides/creating-your-own-custom-transformer
nav: Extending Forge/Functions
order: 3
description: Create, configure, and use a transformer for an application-specific value
teaches: [custom-transformers, transformer, pipe, formatters, inputSchema, outputSchema, argumentsSchema, dependencies]
prerequisites: [field, transformer, how-expressions-work, create-forge-package]
related:
  concept: how-expressions-work, how-answers-work, packaging-journeys-into-an-app
  reference: field
---

# Creating your own custom transformer

Names need tidying. Dates need presenting. References arrive with spaces, dashes, and
lowercase letters, even when the rest of your application expects one dependable shape.
The built-in transformers handle plenty of familiar changes, but your service will
eventually have a value with rules all its own. A custom transformer gives that change a
name: it takes the value it receives, reshapes it, and hands the result back to the
journey. Once defined, it works in a field formatter or a `.pipe()` expression just
like a built-in transformer.

In this guide, we'll create a transformer for case references. People can enter
`ab 1234`, `AB-1234`, or `ab--1234`; we'll turn each one into `AB-1234`.

## Start with the value your page collects

Imagine a page where somebody enters a case reference:

```typescript
const caseReferenceStep = step({
  path: '/case-reference',
  title: 'Case reference',
  blocks: [
    GovUKTextInput({
      code: 'caseReference',
      label: {
        text: 'What is the case reference?',
        isPageHeading: true,
      },
    }),
    GovUKButton({ text: 'Continue' }),
  ],
})
```

The field collects the answer, but it preserves every variation somebody types. That
means later steps have to remember whether a reference contains a space, a dash, or
lowercase letters.

What the page really needs is one small, named operation: "Normalise this case
reference." Let's write it.

## Create the transformer

Here is the transformer:

```typescript [[1, 3, "transformer('Case.NormaliseCaseReference'"], [2, 4, "value: unknown"], [1, 9, "return"]]
import { transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

const NormaliseCaseReference = transformer('Case.NormaliseCaseReference', {
  factory: () => (value: unknown) => {
    const compactReference = String(value).replace(/[^a-z0-9]/gi, '')
    const letters = compactReference.slice(0, 2).toUpperCase()
    const digits = compactReference.slice(2)

    return `${letters}-${digits}`
  },
})
```

The <s1>`transformer()` call</s1> gives the function a name and creates a
`NormaliseCaseReference` entry that the journey can use. When you use it in a journey
definition, it registers itself automatically - no registry or `functions` listing needed.

The <s2>`value`</s2> is the input to reshape. The function removes punctuation and
spaces, separates the first two characters from the digits, and returns the reference in
its canonical form.

## Use the transformer as a field formatter

Now add the transformer to the field's formatters:

```typescript [[3, 7, "formatters: [NormaliseCaseReference()]"]]
GovUKTextInput({
  code: 'caseReference',
  label: {
    text: 'What is the case reference?',
    isPageHeading: true,
  },
  formatters: [NormaliseCaseReference()],
})
```

On submission, the field value passes through the <s3>formatter</s3> before
validation and submit hooks use the answer. Enter `ab 1234`, and the prepared
`caseReference` answer is `AB-1234`.

The transformer is wired up and already useful! The field can accept a forgiving input
while the rest of the journey works with one predictable value.

A formatter is only one place to use it. When you want a transformed value inside an
expression without changing the stored answer, put the same transformer in a pipeline:

```typescript [[4, 2, ".pipe(NormaliseCaseReference())"]]
Answer('caseReference')
  .pipe(NormaliseCaseReference())
```

The <s4>pipeline</s4> passes the answer into the transformer and resolves to its result.
If the answer is absent, the transformer is skipped and the expression remains absent.

## Describe the values going in and coming out

The first version accepts `unknown` and turns it into a string itself. We know more than
that: a case reference should arrive as a string, and the transformer should produce a
string. Describe both boundaries with schemas:

```typescript [[1, 3, "transformer('Case.NormaliseCaseReference'"], [5, 4, "inputSchema: z.string()"], [6, 5, "outputSchema: z.string()"], [2, 6, "value: string"], [1, 11, "return"]]
import { z } from 'zod'

const NormaliseCaseReference = transformer('Case.NormaliseCaseReference', {
  inputSchema: z.string(),
  outputSchema: z.string(),
  factory: () => (value: string) => {
    const compactReference = value.replace(/[^a-z0-9]/gi, '')
    const letters = compactReference.slice(0, 2).toUpperCase()
    const digits = compactReference.slice(2)

    return `${letters}-${digits}`
  },
})
```

The <s5>input schema</s5> says the transformer accepts a string, so the function can
receive `value` as a string and focus on reshaping it. If a present value has another
shape, the invalid input is reported rather than guessing how to convert
it.

The <s6>output schema</s6> checks the other side of the function. If a later change makes
the transformer return something other than a string, that invalid result is reported
where it happens.

## Pass configuration to the transformer

So far, every case reference uses a dash. Suppose a compact label needs `AB/1234`
instead. The normalising work is the same; only the separator changes.

Let `NormaliseCaseReference()` accept the separator:

```typescript [[1, 1, "transformer('Case.NormaliseCaseReference'"], [7, 4, "argumentsSchema"], [2, 6, "value: string"], [7, 7, "separator: '-' | '/'"], [1, 13, "return"]]
const NormaliseCaseReference = transformer('Case.NormaliseCaseReference', {
  inputSchema: z.string(),
  outputSchema: z.string(),
  argumentsSchema: z.tuple([z.enum(['-', '/'])]),
  factory: () => (
    value: string,
    separator: '-' | '/',
  ) => {
    const compactReference = value.replace(/[^a-z0-9]/gi, '')
    const letters = compactReference.slice(0, 2).toUpperCase()
    const digits = compactReference.slice(2)

    return `${letters}${separator}${digits}`
  },
})
```

Choose the <s7>separator</s7> where the transformer is used:

```typescript [[3, 2, "NormaliseCaseReference"], [7, 2, "'-'"]]
formatters: [
  NormaliseCaseReference('-'),
],
```

The field supplies the <s2>value</s2> when the formatter runs. The `'-'` argument is
supplied by the definition and arrives next as `separator`.

The <s7>arguments schema</s7> describes the choices an author can supply. If a
definition passes another value, the invalid argument is reported instead of running
the transformer with configuration it doesn't understand.

## Use a dependency in your transformer

The case-reference rules may already live in application code used outside Forge. Rather
than repeat them, inject that existing formatter into the transformer.

Keep this collaborator focused on transforming the value. Transformers can be evaluated
wherever an expression is resolved, so saving records or calling an external service
belongs in an effect instead.

```typescript [[8, 12, "deps: { caseReferenceFormatter: CaseReferenceFormatter }"], [2, 3, "value: string"], [7, 4, "separator: '-' | '/'"], [8, 16, "deps.caseReferenceFormatter.normalise"]]
interface CaseReferenceFormatter {
  normalise(
    value: string,
    separator: '-' | '/',
  ): string
}

const NormaliseCaseReference = transformer('Case.NormaliseCaseReference', {
  inputSchema: z.string(),
  outputSchema: z.string(),
  argumentsSchema: z.tuple([z.enum(['-', '/'])]),
  factory: (deps: { caseReferenceFormatter: CaseReferenceFormatter }) => (
    value: string,
    separator: '-' | '/',
  ) => {
    return deps.caseReferenceFormatter.normalise(
      value,
      separator,
    )
  },
})
```

The <s8>`deps` object</s8> gives the transformer access to the application's reference
formatter. The application owns the reference-formatting rules, while the transformer
gives those rules a name the journey can use.

Supply the dependency when the application registers the package:

```typescript [[8, 2, "caseReferenceFormatter", 0]]
forge.registerPackage(casePackage, {
  caseReferenceFormatter: services.caseReferenceFormatter,
})
```

Nothing changes in the field:

```typescript
formatters: [
  NormaliseCaseReference('-'),
]
```

## See how the transformer parts fit together

You have now used every part of a transformer function. Its complete shape is:

```text [[8, 1, "deps"], [2, 1, "value"], [7, 1, "...arguments"], [6, 1, "output | Promise<output>"]]
deps => (value, ...arguments) => output | Promise<output>
```

The outer function receives your application's <s8>dependencies</s8>. The inner
function receives the <s2>value being transformed</s2>, followed by any
<s7>configuration arguments</s7>, and returns the <s6>transformed output</s6>. A
transformer may return that output immediately or as a promise.

Simple transformers don't need to use every part of this shape. The first version of
`NormaliseCaseReference()` ignored its dependencies, accepted no arguments, and returned
its string immediately.

Your transformer is ready to use. Before applying it throughout a journey, test a messy
reference and check the canonical value it produces. [Testing a
function](./testing-a-function) shows how to test a transformer directly.

## Recap

You now have one named operation that turns several case-reference spellings into the
canonical value your journey expects.

Let's recap the key points.

- Define custom transformers with `transformer()` and give each one a name.
- Write each transformer as a function that receives a value and returns its transformed
  output.
- Use input and output schemas to describe the transformer's boundaries.
- Pass arguments when the definition needs to configure the transformation.
- Use an injected dependency when transformation rules already belong to application
  code.
- Use the returned transformer in a field formatter or a `.pipe()` expression.
- Keep transformers free of side effects.
