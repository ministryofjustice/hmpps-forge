---
title: Inlining functions
section: building-functions-and-components
path: building-functions-and-components/inline-functions
teaches: [createFunctionScope, FunctionScope, inline-transformer, inline-condition, inline-effect, inline-generator, scope-implementations]
prerequisites: [defineTransformerFunctions, defineEffectFunctions, createForgePackage, pipe, match-method]
---

<p class="govuk-caption-xl">Functions</p>

# Inlining functions

`createFunctionScope` lets you define one-off functions directly
where they are used, without a separate shape interface or
implementation file.

{{slot:toc}}

---

## The concept

The `define*Functions` helpers separate a function into three
pieces: a shape interface, a factory implementation, and a
registration step. That separation is valuable when functions are
shared across steps or form a named part of a package's API.

But some functions are local to a single block or step. A
transformer that shapes data for one summary list, a condition
that controls one `visibleWhen`, or an effect that loads data for
one page. For these, the three-file ceremony adds friction without
adding clarity.

A function scope inverts the flow. Instead of defining functions
in one place and importing them where they are used, you define
them at the call site and the scope collects them for registration
automatically:

```text
define*Functions:
  shape.ts  →  implementations.ts  →  package index  →  blocks.ts

createFunctionScope:
  blocks.ts  →  package index (implementations collected automatically)
```

The scope is a package-level collector. Each call to one of its
methods does two things at once: it stores the factory for
registration, and it returns the expression builder that the
definition needs.

---

## How it works

When a module that contains scope calls is imported, each call
registers a factory function in the scope's internal collection.
This happens at module evaluation time, before any request is
served.

At application startup, the package entry spreads
`scope.implementations` into the `functions` property of
`createForgePackage`. From that point on, the collected functions
go through the same registry and dependency injection pipeline as
`define*Functions` output. Each factory receives the same
dependencies object.

```text
1. Module imports         scope.transformer('Name', factory)
                          → stores factory, returns expression

2. Package registration   createForgePackage({ functions: { ...scope.implementations } })
                          → factories enter the registry

3. Dependency injection   forge.registerPackage(pkg, deps)
                          → each factory receives deps

4. Request time           engine evaluates expression
                          → calls factory(deps)(value, ...args)
```

Because module evaluation is synchronous and completes before
`createForgePackage` reads `scope.implementations`, every factory
registered through the scope is available by the time the package
is assembled. One scope per package is the intended pattern. This
ensures all inline functions flow through a single collector
regardless of which step or block file defines them.

---

## API surface

### createFunctionScope()

Creates a new function scope. The type parameter is the same
dependency type passed to `createForgePackage`. Omit it when
inline functions do not need dependencies:

```typescript
import { createFunctionScope } from '@ministryofjustice/hmpps-forge/core/authoring'

export const MyFunctions = createFunctionScope<MyDeps>()
```

```typescript
export const MyFunctions = createFunctionScope()
```

### scope.transformer()

Defines an inline transformer. Returns a `TransformerFunctionExpr`
for use with `.pipe()`:

```typescript
import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKSummaryList } from '@ministryofjustice/hmpps-forge/govuk-components'
import { MyFunctions } from '../../functions'

export const caseSummary = GovUKSummaryList({
  rows: Data('caseDetails').pipe(
    MyFunctions.transformer(
      'ToCaseSummaryRows',
      () => (value: unknown) => {
        const details = value as CaseDetails

        return [
          { key: { text: 'Name' }, value: { text: details.person.fullName } },
          { key: { text: 'Status' }, value: { text: details.status } },
        ]
      },
    ),
  ),
})
```

The factory follows the same `(deps) => (value, ...args) => result`
shape as `defineTransformerFunctions`. The outer function receives
the package dependencies. The inner function receives the resolved
value and any arguments.

### scope.condition()

Defines an inline condition. Returns a `ConditionFunctionExpr` for
use with `.match()`:

```typescript
export const urgentBanner = GovUKBody({
  text: 'This case requires immediate attention.',
  visibleWhen: Data('caseDetails').match(
    MyFunctions.condition(
      'IsUrgent',
      () => (value: unknown) => {
        const details = value as CaseDetails

        return details.priority === 'urgent' && details.status !== 'closed'
      },
    ),
  ),
})
```

### scope.effect()

Defines an inline effect. Returns an `EffectFunctionExpr` for use
in `onAccess` and `onSubmission` hooks:

```typescript
export const myStep = step({
  path: '/overview',
  title: 'Overview',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      effects: [
        MyFunctions.effect(
          'LoadOverviewData',
          (deps) => async (context) => {
            const data = await deps.api.getOverview()
            context.setData('overview', data)
          },
        ),
      ],
    }),
  ],
  blocks: [content],
})
```

### scope.generator()

Defines an inline generator. Returns a `GeneratorBuilder` that
resolves automatically inside `block()`, `step()`, and `journey()`
definitions:

```typescript
export const timestamp = GovUKBody({
  text: MyFunctions.generator(
    'CurrentYear',
    () => () => new Date().getFullYear().toString(),
  ),
})
```

### scope.implementations

A read-only object containing every factory registered through the
scope. Spread it into the `functions` property of
`createForgePackage`:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { MyFunctions } from './functions'
import { myEffectImplementations } from './effects'
import { journey } from './journey'

export default createForgePackage<MyDeps>({
  journey,
  functions: {
    ...myEffectImplementations,
    ...MyFunctions.implementations,
  },
})
```

---

## Name handling

Every inline function needs a unique name. The name is how Forge
identifies the function in the registry.

When a helper function calls a scope method more than once with
the same name and factory, the scope recognises the duplicate and
reuses the first registration. This makes it safe to use scope
calls inside reusable helpers:

```typescript
const statusTag = (code: string) =>
  Answer(code).pipe(
    MyFunctions.transformer(
      'ToStatusTag',
      () => (value: unknown) => {
        if (value === 'completed') return { text: 'Completed', classes: 'govuk-tag--green' }
        if (value === 'in-progress') return { text: 'In progress', classes: 'govuk-tag--blue' }

        return { text: 'Not yet started' }
      },
    ),
  )

statusTag('task1Status')
statusTag('task2Status')
```

Both calls reuse the same registered implementation. Only the pipe
argument differs.

The scope compares factories by reference first, then by source
text. If two calls pass the same function reference or identical
inline functions, the scope treats them as the same
implementation. If the factories differ, it throws at module load
time:

```typescript
MyFunctions.transformer('ToStatusTag', () => (value: unknown) => somethingDifferent(value))
// Throws: 'Function scope already contains a different implementation named "ToStatusTag"'
```

---

## Best practices

- **One scope per package.** Create the scope in a shared file and
  import it into step and block files. This keeps all inline
  functions flowing through a single collector and avoids splitting
  implementations across multiple registrations.
- **Use `define*Functions` for shared functions.** If more than one
  step uses the same function, or if the function is complex enough
  to warrant its own tests, define it with the full shape and
  implementation pattern.
- **Use `createFunctionScope` for local functions.** If a function
  exists only to serve one block or step, defining it inline keeps
  the definition and the logic together.
- **Name functions after what they produce.** `ToCaseSummaryRows`
  describes the output. `ProcessCaseData` does not. A clear name
  also makes registry conflicts easier to diagnose.
- **Keep inline functions short.** If an inline function grows
  beyond 10 to 15 lines, it is probably complex enough to benefit
  from its own file, its own tests, and the `define*Functions`
  pattern.
