---
title: Params()
slug: params
section: reference
path: reference/params
nav: Authoring API/References
order: 57
description: References a route parameter from the current URL
teaches: [params, references, route-parameters]
prerequisites: [step]
related:
  reference: query, post, data
---

# `Params()`

`Params()` references a route parameter from the current URL. You use it to read values
captured by named segments in the route path, like the `:caseId` in `/case/:caseId`.

```typescript
import { Params } from '@ministryofjustice/hmpps-forge/core/authoring'

// Pass a route parameter to an effect
LoadCase(Params('caseId'))

// Display a route parameter
Format('Edit goal %1', Params('goalId'))

// Match a route parameter inside an iterator
Item().path('id').match(Condition.Equals(Params('userId')))
```

---

## Reference

### `Params(key)`

Creates a reference expression that resolves to a route parameter from the current
request.

```typescript
function Params(key: string): ChainableRef
```

:::param
---
name: key
type: "string"
required: true
---
The route parameter name to reference. Must match a named segment in the route path.
Dot notation navigates into nested values if the parameter value is an object.
:::

#### Returns

A `ChainableRef` - the same immutable expression builder that [`Answer()`](./answer)
returns. All the same methods are available: `.path()`, `.pipe()`, `.match()`, `.not`,
and `.each()`. See the [Answer() methods documentation](./answer#methods) for details.

---

## Usage

### Pass a route parameter to an effect

Route parameters often identify which record to load:

```typescript
onAccess: [
  accessHook({
    effects: [LoadCase(Params('caseId'))],
  }),
]
```

The effect receives the resolved `caseId` value from the URL.

### Display a route parameter

Use a reference directly in a component property or format expression:

```typescript
Format('Editing case %1', Params('caseId'))
```

### Test a route parameter

`.match()` tests the resolved value and returns a predicate:

```typescript
visibleWhen: Params('mode').match(Condition.Equals('edit'))
```

---

## Troubleshooting

### The parameter is always undefined

A missing route parameter resolves silently to `undefined`. Check that the parameter
name matches a named segment in the route path. `Params('caseId')` reads from a route
like `/case/:caseId` - if the route has no `:caseId` segment, the value is `undefined`.
