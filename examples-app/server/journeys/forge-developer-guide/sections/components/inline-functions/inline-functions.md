---
title: Inlining functions
section: building-functions-and-components
path: building-functions-and-components/inline-functions
teaches: [anonymous-registration, inline-transformer, inline-condition, inline-effect, inline-generator]
prerequisites: [TransformerRegistry, EffectRegistry, createForgePackage, pipe, match-method]
---

<p class="govuk-caption-xl">Functions</p>

# Inlining functions

Registering a function without a name lets you define one-off
functions directly where they are used, inline at the call site.

{{slot:toc}}

---

## The concept

A named registration gives a function a stable key and a documented
handle. That is valuable when a function is shared across steps or
forms a named part of a package's API.

But some functions are local to a single block or step. A
transformer that shapes data for one summary list, a condition that
controls one `visibleWhen`, or an effect that loads data for one
page. For these, a separate name and grouped handle add friction
without adding clarity.

Every registry's `register` method has an overload that omits the
name. Call it with just a factory (or an options object and a
factory) and it stores the function under an auto-generated name and
returns the expression handle for immediate use. Calling the handle
— note the trailing `()` — produces the expression the definition
needs:

```text
Named registration:
  registry.register('Name', factory)  →  grouped handle  →  used in blocks.ts

Anonymous registration:
  registry.register(factory)()        →  expression used inline, right here
```

The registry is the collector. Each `register` call does two things
at once: it stores the factory for registration, and it returns the
expression handle that the definition needs.

---

## How it works

When a module that contains `register` calls is imported, each call
stores a factory function in the registry. This happens at module
evaluation time, before any request is served.

At application startup, the package entry passes the registry to the
`functions` property of `createForgePackage`. From that point on,
the collected functions go through the same dependency injection
pipeline as named registrations. Each factory receives the same
dependencies object.

```text
1. Module imports         registry.register(factory)
                          → stores factory, returns expression handle

2. Package registration   createForgePackage({ functions: registry })
                          → registry's factories enter the pipeline

3. Dependency injection   forge.registerPackage(pkg, deps)
                          → each factory receives deps

4. Request time           engine evaluates expression
                          → calls factory(deps)(value, ...args)
```

Because module evaluation is synchronous and completes before
`createForgePackage` reads the registry, every factory registered
this way is available by the time the package is assembled.

Anonymous registrations are named automatically in call order —
`__anon_0`, `__anon_1`, and so on. These names are internal; you
never reference them. If you want a stable registry key for
debugging, pass a name and register as normal.

> The deprecated `createFunctionScope` helper solved the same
> problem before registries existed. Prefer anonymous registration
> on a registry now.

---

## Registries per kind

Registries are typed to one function kind, so a package that uses
inline functions of several kinds creates one registry per kind,
usually in a shared file:

```typescript
import {
  ConditionRegistry,
  TransformerRegistry,
  EffectRegistry,
  GeneratorRegistry,
} from '@ministryofjustice/hmpps-forge/core/authoring'

export const inlineConditions = new ConditionRegistry<MyDeps>()
export const inlineTransformers = new TransformerRegistry<MyDeps>()
export const inlineEffects = new EffectRegistry<MyDeps>()
export const inlineGenerators = new GeneratorRegistry<MyDeps>()
```

Omit the `<MyDeps>` type parameter on any registry whose inline
functions do not need dependencies.

Import the registry you need into each block or step file.

### Inline transformer

`register` returns a handle; calling it produces a
`TransformerFunctionExpr` for use with `.pipe()`:

```typescript
import { Data } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKSummaryList } from '@ministryofjustice/hmpps-forge/govuk-components'
import { inlineTransformers } from '../../functions'

export const caseSummary = GovUKSummaryList({
  rows: Data('caseDetails').pipe(
    inlineTransformers.register((deps) => (value: unknown) => {
      const details = value as CaseDetails

      return [
        { key: { text: 'Name' }, value: { text: details.person.fullName } },
        { key: { text: 'Status' }, value: { text: details.status } },
      ]
    })(),
  ),
})
```

The factory follows the same `(deps) => (value, ...args) => result`
shape as a named transformer. The outer function receives the
package dependencies. The inner function receives the resolved value
and any arguments.

### Inline condition

`register` returns a handle; calling it produces a
`ConditionFunctionExpr` for use with `.match()`:

```typescript
import { inlineConditions } from '../../functions'

export const urgentBanner = GovUKBody({
  text: 'This case requires immediate attention.',
  visibleWhen: Data('caseDetails').match(
    inlineConditions.register((deps) => (value: unknown) => {
      const details = value as CaseDetails

      return details.priority === 'urgent' && details.status !== 'closed'
    })(),
  ),
})
```

### Inline effect

`register` returns a handle; calling it produces an
`EffectFunctionExpr` for use in `onAccess` and `onSubmission`
hooks:

```typescript
import { inlineEffects } from '../../functions'

export const myStep = step({
  path: '/overview',
  title: 'Overview',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      effects: [
        inlineEffects.register((deps) => async (context) => {
          const data = await deps.api.getOverview()
          context.setData('overview', data)
        })(),
      ],
    }),
  ],
  blocks: [content],
})
```

### Inline generator

`register` returns a handle; calling it produces a
`GeneratorBuilder` that resolves automatically inside `block()`,
`step()`, and `journey()` definitions:

```typescript
import { inlineGenerators } from '../../functions'

export const timestamp = GovUKBody({
  text: inlineGenerators.register(() => () => new Date().getFullYear().toString())(),
})
```

---

## Registration

Pass every registry that collects inline functions to the
`functions` property of `createForgePackage`. It accepts an array
when a package uses more than one kind:

```typescript
import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { inlineConditions, inlineTransformers, inlineEffects, inlineGenerators } from './functions'
import { journey } from './journey'

export default createForgePackage<MyDeps>({
  journey,
  functions: [inlineConditions, inlineTransformers, inlineEffects, inlineGenerators],
})
```

The array can mix registries that hold inline functions with
registries whose functions are named. Every registry passed to
`functions` goes through the same dependency injection pipeline when
you call `forge.registerPackage(pkg, deps)`.

---

## Reusing an inline function

`register` returns a handle you can capture and call more than once.
When the same logic is needed in several places, register it once at
module level and call the handle wherever you need it, rather than
registering the function inline each time:

```typescript
import { Answer } from '@ministryofjustice/hmpps-forge/core/authoring'
import { inlineTransformers } from '../../functions'

const toStatusTag = inlineTransformers.register((deps) => (value: unknown) => {
  if (value === 'completed') return { text: 'Completed', classes: 'govuk-tag--green' }
  if (value === 'in-progress') return { text: 'In progress', classes: 'govuk-tag--blue' }

  return { text: 'Not yet started' }
})

const statusTag = (code: string) => Answer(code).pipe(toStatusTag())

statusTag('task1Status')
statusTag('task2Status')
```

Both calls reuse the same registration. Only the piped reference
differs. Registering once also keeps the registry free of duplicate
entries: calling `register` inside a helper that runs more than once
would store the same factory under several anonymous names.

---

## Best practices

- **One registry per kind per package.** Create the registries in a
  shared file and import them into step and block files. This keeps
  all inline functions of a kind flowing through a single collector.
- **Register shared logic once.** Capture the handle at module level
  and reuse it, rather than registering the same function inline in
  several places.
- **Use named registrations for shared functions.** If more than one
  step uses the same function, or if the function is complex enough
  to warrant its own tests, register it with a name and group it in
  a handle object, as the custom-function pages describe.
- **Use anonymous registration for local functions.** If a function
  exists only to serve one block or step, registering it inline
  keeps the definition and the logic together.
- **Keep inline functions short.** If an inline function grows
  beyond 10 to 15 lines, it is probably complex enough to benefit
  from its own file, its own tests, and a named registration.
