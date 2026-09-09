---
title: Query()
slug: query
section: reference
path: reference/query
nav: Authoring API/References
order: 56
description: References a query-string parameter from the current URL
teaches: [query, references, query-string]
prerequisites: [step]
related:
  reference: params, post, data
---

# `Query()`

`Query()` references a query-string parameter from the current URL. You use it to read
values appended after the `?` in the URL, like the `returnTo` in
`/summary?returnTo=check-answers`.

```typescript
import { Query } from '@ministryofjustice/hmpps-forge/core/authoring'

// Redirect based on a query parameter
redirect({
  when: Query('returnTo').match(Condition.Equals('check-answers')),
  goto: 'check-answers',
})

// Resume a journey from a query flag
resumeWhen: Query('resume').match(Condition.Equals('true'))
```

---

## Reference

### `Query(key)`

Creates a reference expression that resolves to a query-string parameter from the
current request.

```typescript
function Query(key: string): ChainableRef
```

:::param
---
name: key
type: "string"
required: true
---
The query-string parameter name to reference. Dot notation navigates into nested values
if the parameter value is an object.
:::

#### Returns

A `ChainableRef` - the same immutable expression builder that [`Answer()`](./answer)
returns. All the same methods are available: `.path()`, `.pipe()`, `.match()`, `.not`,
and `.each()`. See the [Answer() methods documentation](./answer#methods) for details.

:::note
---
---
A repeated query key (like `?tag=a&tag=b`) can produce an array rather than a single
string. If the expression expects a string, test or transform the value before using it.
:::

---

## Usage

### Drive navigation with a query parameter

Query parameters can control where a step navigates after submission:

```typescript
redirect({
  when: Query('returnTo').match(Condition.Equals('check-answers')),
  goto: 'check-answers',
})
```

This sends the user to the check-answers step when the URL contains
`?returnTo=check-answers`.

### Test a query parameter in a condition

A query parameter can drive conditional logic:

```typescript
resumeWhen: Query('resume').match(Condition.Equals('true'))
```

### Test a query parameter for visibility

```typescript
visibleWhen: Query('debug').match(Condition.Equals('true'))
```

This makes the block visible only when `?debug=true` is in the URL.

---

## Troubleshooting

### The query parameter is always undefined

A missing query parameter resolves silently to `undefined`. Check that the parameter
name matches the key in the URL. `Query('returnTo')` reads from a URL like
`/summary?returnTo=check-answers` - if the query string has no `returnTo` key, the
value is `undefined`.
