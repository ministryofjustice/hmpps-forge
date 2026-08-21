---
title: Inlining functions
section: building-functions-and-components
path: building-functions-and-components/inline-functions
teaches: [anonymous-registration, inline-transformer, inline-condition, inline-effect, inline-generator]
prerequisites: [transformer, effect, createForgePackage, pipe, match-method]
---

<p class="govuk-caption-xl">Functions</p>

# Inlining functions

Defining a function without a name lets you write one-off
functions directly where they are used, inline at the call site.

{{slot:toc}}

---

## The concept

A named entry gives a function a stable key and a documented
handle. That is valuable when a function is shared across steps or
forms a named part of a package's API.

But some functions are local to a single block or step. A
transformer that shapes data for one summary list, a condition that
controls one `visibleWhen`, or an effect that loads data for one
page. For these, a separate name and an exported handle add
friction without adding clarity.

Each of `condition()`, `transformer()`, `generator()`, and
`effect()` has an overload that omits the name. Call it with just
the options object and it returns the same kind of handle, named
automatically at registration. Calling the handle — note the
trailing `()` — produces the expression the definition needs:

```text
Named:      export const Truncate = transformer('Truncate', { factory })
            → handle imported into blocks.ts

Anonymous:  transformer({ factory })()
            → expression used inline, right here
```

One call defines the function and builds the expression in place.

---

## How it works

Anonymous entries register the same way named ones do: using the
handle in a journey definition embeds the entry in the definition,
and at `registerPackage()` Forge walks the journey, collects every
embedded entry, and registers its evaluator. There is no registry
to create and nothing to pass to `createForgePackage` - the
`functions` property is not involved.

```text
1. Module evaluation      transformer({ factory })()
                          → creates the entry, embeds its expression

2. Package registration   forge.registerPackage(pkg, deps)
                          → Forge collects embedded entries,
                            each factory receives deps

3. Request time           engine evaluates expression
                          → calls factory(deps)(value, ...args)
```

Anonymous entries are named automatically when they are collected.
These names are internal; you never reference them. If you want a
stable name for debugging and diagnostics, pass one and the entry
behaves exactly the same otherwise.

---

## Inlining each kind

### Inline transformer

Calling the handle produces a `TransformerFunctionExpr` for use
with `.pipe()`:

```typescript
import { Data, transformer } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKSummaryList } from '@ministryofjustice/hmpps-forge/govuk-components'

export const caseSummary = GovUKSummaryList({
  rows: [
    {
      key: { text: 'Status' },
      value: {
        text: Data('caseDetails').pipe(
          transformer({
            factory: () => (value: unknown) => {
              const details = value as CaseDetails

              return details.status === 'closed' ? 'Closed' : `Open - ${details.priority}`
            },
          })(),
        ),
      },
    },
  ],
})
```

The factory follows the same `(deps) => (value, ...args) => result`
shape as a named transformer. The outer function receives the
package dependencies. The inner function receives the resolved value
and any arguments.

### Inline condition

Calling the handle produces a `ConditionFunctionExpr` for use with
`.match()`:

```typescript
import { Data, condition } from '@ministryofjustice/hmpps-forge/core/authoring'

export const urgentBanner = GovUKBody({
  text: 'This case requires immediate attention.',
  visibleWhen: Data('caseDetails').match(
    condition({
      factory: () => (value: unknown) => {
        const details = value as CaseDetails

        return details.priority === 'urgent' && details.status !== 'closed'
      },
    })(),
  ),
})
```

### Inline effect

Calling the handle produces an `EffectFunctionExpr` for use in
`onAccess` and `onSubmission` hooks:

```typescript
import { access, effect, step } from '@ministryofjustice/hmpps-forge/core/authoring'

export const myStep = step({
  path: '/overview',
  title: 'Overview',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      effects: [
        effect<MyDeps>({
          factory: (deps) => async (context) => {
            const data = await deps.api.getOverview()
            context.setData('overview', data)
          },
        })(),
      ],
    }),
  ],
  blocks: [content],
})
```

### Inline generator

Calling the handle produces a chainable builder that resolves
automatically inside `block()`, `step()`, and `journey()`
definitions:

```typescript
import { generator } from '@ministryofjustice/hmpps-forge/core/authoring'

export const timestamp = GovUKBody({
  text: generator({ factory: () => () => new Date().getFullYear().toString() })(),
})
```

---

## Reusing an inline function

The helper returns a handle you can capture and call more than
once. When the same logic is needed in several places, define it
once at module level and call the handle wherever you need it,
rather than defining the function inline each time:

```typescript
import { Answer, transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

const toStatusTag = transformer({
  factory: () => (value: unknown) => {
    if (value === 'completed') return { text: 'Completed', classes: 'govuk-tag--green' }
    if (value === 'in-progress') return { text: 'In progress', classes: 'govuk-tag--blue' }

    return { text: 'Not yet started' }
  },
})

const statusTag = (code: string) => Answer(code).pipe(toStatusTag())

statusTag('task1Status')
statusTag('task2Status')
```

Both calls reuse the same entry. Only the piped reference differs.
Defining once also keeps registration clean: calling `transformer()`
inside a helper that runs more than once creates a separate entry
on every call, so the same logic registers under several anonymous
names.

---

## Best practices

- **Define shared logic once.** Capture the handle at module level
  and reuse it, rather than defining the same function inline in
  several places.
- **Use names for shared functions.** If more than one step uses
  the same function, or if the function is complex enough to
  warrant its own tests, give it a name and export the handle, as
  the custom-function pages describe.
- **Use anonymous entries for local functions.** If a function
  exists only to serve one block or step, defining it inline keeps
  the definition and the logic together.
- **Keep inline functions short.** If an inline function grows
  beyond 10 to 15 lines, it is probably complex enough to benefit
  from its own file, its own tests, and a name.
