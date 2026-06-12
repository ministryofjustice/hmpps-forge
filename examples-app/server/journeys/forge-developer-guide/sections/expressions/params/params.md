---
title: Params
section: authoring-language
path: authoring-language/params
teaches: [Params, route-parameters, parameterised-paths]
prerequisites: [step, StepDefinition, path, routing]
---

<p class="govuk-caption-xl">References</p>

# Params

`Params()` references URL route parameters. When a step's path
includes a named segment like `:itemId`, `Params('itemId')` resolves
to whatever value appears in that position at runtime.

{{slot:toc}}

---

## What is Params?

Steps and journeys can include route parameters in their paths. A
step at `/items/:itemId` matches any URL like `/items/abc123`, and
the value `abc123` is captured as the `itemId` parameter.
`Params('itemId')` creates a reference to that captured value.

```typescript
import { Params } from '@ministryofjustice/hmpps-forge/core/authoring'

Params('itemId')
```

Route parameters make journeys work for specific resources. A case
management journey at `/case/:caseId` can render the right case on
every page without hard-coding any identifiers. Each step and access
hook receives the same parameter values from the URL.

---

## How it works

Route parameters are defined by prefixing a path segment with `:`.
Forge uses the same syntax as Express:

```typescript
journey({
  code: 'case-management',
  path: '/case/:caseId',
  steps: [overviewStep, editStep],
})
```

When a request arrives at `/case/A1234BC/overview`, Forge extracts
`caseId` as `'A1234BC'` and makes it available through
`Params('caseId')` for the duration of that request.

In effect functions, the same values are available through
`context.getRequestParam(key)` and `context.getAllRequestParams()`:

```typescript
LoadCaseData: (deps) => async (context) => {
  const caseId = context.getRequestParam('caseId')

  if (!caseId) {
    return
  }

  const caseData = await deps.caseApi.getCase(caseId)
  context.setData('case', caseData)
}
```

Parameters can appear at any level. A journey parameter is available
to all its steps and child journeys. A step can add its own
parameters too:

```typescript
step({
  path: '/goal/:goalId/add-steps',
  title: 'Add steps to goal',
  ...
})
```

Inside this step, both `Params('caseId')` from the parent journey
and `Params('goalId')` from the step itself are available.

---

## Using in your definitions

The most common use for `Params()` is passing route parameters into
effect functions so they can load the right data:

```typescript
onAccess: [
  access({
    effects: [MyEffects.LoadCaseData(Params('caseId'))],
    next: [
      throwError({
        when: Data('case').not.match(Condition.IsRequired()),
        status: 404,
        message: 'Case not found',
      }),
    ],
  }),
]
```

Parameters also work in conditions. You can validate that a
parameter has an expected value before allowing access:

```typescript
access({
  when: Params('areaOfNeed').not.match(
    Condition.Array.IsIn(Data('validAreas')),
  ),
  next: [redirect({ goto: '/not-found' })],
})
```

And in `Format()` for building dynamic URLs in redirects and links:

```typescript
redirect({
  goto: Format('../%1/add-steps', Params('goalId')),
})
```

```typescript
GovUKButton({
  text: 'View history',
  href: Format('%1?type=current', Params('timestamp')),
})
```

Like any reference, parameters can be transformed with `.pipe()`:

```typescript
GovUKHeading({
  text: Format('Plan from %1', Params('timestamp').pipe(
    Transformer.String.ToTimestampDate(),
    Transformer.Date.Format('Do MMMM YYYY'),
  )),
})
```

---

## API surface

### `Params(key)`

Creates a reference to a URL route parameter.

```typescript
import { Params } from '@ministryofjustice/hmpps-forge/core/authoring'
```

`key` is a string matching a `:paramName` segment in the step or
journey path.

Returns a chainable reference that supports `.path()`, `.match()`,
`.pipe()`, and `.each()`.

---

## Best practices

- **Load data from parameters in access hooks.** The access
  lifecycle runs on every request, so data is always available when
  the page renders.
- **Validate parameters early.** Check that a parameter refers to a
  real resource before continuing. A `throwError` with a 404 is
  clearer than letting a downstream effect fail.
- **Set journey-level parameters for shared resources.** If every
  step needs the same `:caseId`, put it on the journey path. Steps
  should only add parameters for step-specific resources.
