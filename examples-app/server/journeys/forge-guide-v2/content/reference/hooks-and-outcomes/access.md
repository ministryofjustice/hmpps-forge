---
title: access()
slug: access
section: reference
path: reference/access
nav: Authoring API/Hooks and outcomes
order: 20
description: Creates an access hook that loads request context or controls whether a page can run
teaches: [access, access-hooks, effects, outcomes, request-context]
prerequisites: [journey, step]
related:
  concept: how-forge-runs-a-request, returning-a-page-redirect-or-error
  reference: submit, redirect, throw-error, effect
---

# `access()`

`access()` creates an access hook that runs before Forge prepares answers, checks
reachability, or renders a page.

```typescript
const loadCase = access({
  effects: [CaseEffects.LoadCase()],
  next: [
    throwError({
      when: Data('caseMissing'),
      status: 404,
      message: 'Case not found',
    }),
  ],
})
```

---

## Reference

### `access(definition)`

Call `access()` to create an access hook. Add it to a journey's or step's `onAccess`
array.

[See more examples below.](#usage)

```typescript
function access(definition: Omit<AccessHook, '_forge'>): AccessHook
```

#### Parameters

:::param
---
name: definition
type: Omit<AccessHook, '_forge'>
required: true
---
An object describing when the access hook runs, the work it performs, and any request
outcome it chooses. Its properties are listed below.
:::

#### Definition properties

:::param
---
name: when
type: PredicateExpr
required: false
---
The condition that enables the access hook. When omitted, the hook runs on every request.
When the condition is false, Forge skips its effects and outcomes and continues to the
next access hook.
:::

:::param
---
name: effects
type: EffectFunctionExpr[]
required: false
---
[Effects](./effect) to run after `when` passes. Effects run in order before `next`, so outcomes can
read data or state that an effect has loaded or changed.
:::

:::param
---
name: next
type: HookOutcome[]
required: false
---
[Redirect](./redirect) or [error](./throw-error) outcomes to evaluate after the effects. Forge uses the first matching
outcome. If none match, the request continues to the next access hook and then to answer
preparation.
:::

#### Returns

`access()` returns an access hook definition ready to add to `onAccess` on a journey or
step.

#### Caveats

- Access hooks run before answer preparation. They can read raw submitted data with `Post()`,
  but not the formatted, parsed, and prepared answer for the current `POST`.

- Effects in an access hook run sequentially. There is no hook option to run them in
  parallel. If asynchronous operations can run in parallel, perform them inside one
  effect.

- Journey-level access hooks run on every request to a descendant step. They are not
  one-time journey setup, so keep their effects safe to repeat.

- Access hooks run on both `GET` and `POST` requests. Use a [submit hook](./submit) for work that
  should happen only when a user submits a page.

- A redirect or error outcome ends the request. Later access hooks, answer preparation,
  reachability, and rendering do not run.

- An access hook cannot stop between its effects. Forge runs every declared effect before
  it evaluates `next`. If loaded data should decide whether later work runs, split the
  work into separate access hooks or make that decision inside an effect.

---

## Usage

### Trigger effects when a step is accessed

Trigger an effect when the step is accessed. For example; use an effect to load data that later expressions,
validation, reachability, or rendering need:

```typescript [[4, 5, "onAccess: ["], [1, 6, "access({"], [2, 7, "effects: [ApplicationEffects.LoadApplication"]]
const applicationsJourney = journey({
  path: '/applications/:applicationId',
  code: 'applications',
  title: 'Application',
  onAccess: [
    access({
      effects: [ApplicationEffects.LoadApplication(Params('applicationId'))],
    }),
  ],
  steps: [overviewStep, contactDetailsStep],
})
```

The <s1>access hook</s1> is attached at <s4>journey scope</s4>, so it runs before either
step is evaluated. Its <s2>effect</s2> makes the application available as <s3>request
data</s3>, which both steps can read with `Data('application')`.

Put an access hook on a step when its data or access control only applies to that page:

```typescript [[4, 4, "onAccess: ["], [1, 5, "access({"], [2, 6, "effects: [ApplicationEffects.LoadDocuments"]]
const documentsStep = step({
  path: '/documents',
  title: 'Application documents',
  onAccess: [
    access({
      effects: [ApplicationEffects.LoadDocuments()],
    }),
  ],
  blocks: [documentsHeading, documentsTable],
})
```

For a step request, Forge runs access hooks from the outermost journey inwards, followed
by the step's hooks. This <s1>access hook</s1> is at <s4>step scope</s4>, so it applies
only to this page. Use journey scope for shared context and step scope for page-only work.

### Stop a request after loading data

Put outcomes after an effect when the loaded state determines whether the request can
continue:

```typescript [[1, 1, "access({"], [2, 2, "effects: [ApplicationEffects.LoadApplication"], [5, 3, "next: ["], [5, 4, "throwError({"], [3, 5, "Data('applicationMissing')"], [5, 9, "redirect({"], [3, 10, "Data('canViewApplication')"]]
const loadApplication = access({
  effects: [ApplicationEffects.LoadApplication(Params('applicationId'))],
  next: [
    throwError({
      when: Data('applicationMissing'),
      status: 404,
      message: 'Application not found',
    }),
    redirect({
      when: Data('canViewApplication').match(Condition.Equals(false)),
      goto: '/applications',
    }),
  ],
})
```

The <s3>request data</s3> loaded by the effect decides which <s5>outcome</s5> applies.
Forge checks outcomes in order. A missing application produces the error; otherwise, a
user without access is redirected. If neither condition passes, the request continues.

---

## Troubleshooting

### Data is unavailable to a later expression

Effects in an access hook must write loaded values to request state that Forge expressions
can read. Check that the effect runs before the expression needs the data and that it uses
the same `Data()` path the definition reads.

### An outcome from an access hook does not run

`next` outcomes run only after the hook's `when` passes and all its effects complete.
Forge uses the first matching outcome, so check earlier outcome conditions as well as the
condition on the expected outcome.
