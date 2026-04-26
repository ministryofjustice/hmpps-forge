---
title: Query
section: authoring-language
path: authoring-language/query
teaches: [Query, query-string, query-parameters]
prerequisites: [step, StepDefinition, onAccess]
---

<p class="govuk-caption-xl">References</p>

# Query

`Query()` references URL query string parameters. When a user
navigates to `/overview?type=current`, `Query('type')` resolves to
`'current'`. It's how you respond to optional context passed through
the URL without it being part of the route structure.

{{slot:toc}}

---

## What is Query?

Query string parameters are the key-value pairs that appear after
the `?` in a URL. Unlike route parameters, they are not defined in
the step's path. They can be present or absent on any request, which
makes them well suited for optional concerns like filters, display
state, and default values.

```typescript
import { Query } from '@ministryofjustice/hmpps-forge/core/authoring'

Query('type')
```

A typical use is filtering what a page displays. A URL like
`/results?type=current` tells the page which subset to show, and
an access hook can redirect to a sensible default when the
parameter is missing or invalid:

```typescript
access({
  when: Query('type').not.match(
    Condition.Array.IsIn(['current', 'future', 'achieved']),
  ),
  next: [redirect({ goto: 'overview?type=current' })],
})
```

Because query parameters are optional by nature, you will often
guard on their presence with `Condition.IsRequired()` or validate
their value before acting on them.

---

## How it works

When Forge evaluates `Query('type')`, it reads the value from the
current request's query string. If the parameter is present, the
expression resolves to its string value. If it is absent, it
resolves to `undefined`.

Query string values are always strings. A URL like `?page=2` gives
`Query('page')` the value `'2'`, not the number `2`. Use `.pipe()`
with a transformer if you need a different type.

In effect functions, the same values are available through
`context.getQuery()`:

```typescript
LoadFilteredResults: (deps) => async (context) => {
  const type = context.getQuery().type ?? 'current'
  const results = await deps.api.getGoals(type)
  context.setData('goals', results)
}
```

---

## Using in your definitions

### Filtering and display state

Query parameters work well for controlling what a page shows
without changing the underlying route. A tabs-style interface, a
sort order, or a search filter can all be driven by query
parameters:

```typescript
access({
  when: Query('type').not.match(
    Condition.Array.IsIn(['current', 'future', 'achieved']),
  ),
  next: [redirect({ goto: 'overview?type=current' })],
})
```

### Preserving query values in links

Use `Format()` to carry query parameters through to other URLs,
so context is not lost when the user navigates:

```typescript
backlink: when(Query('type').match(Condition.IsRequired()))
  .then(Format('overview?type=%1', Query('type')))
  .else('overview')
```

### Pre-filling fields

A query parameter can set a field's initial value. A search page
linked to with `?q=something` can pre-populate the search box:

```typescript
GovUKTextInput({
  code: 'searchTerm',
  label: { text: 'Search' },
  defaultValue: Query('q'),
})
```

### Conditional visibility

Show or hide blocks based on a query parameter:

```typescript
GovUKInsetText({
  text: 'Need help? Contact the support team.',
  visibleWhen: Query('showHelp').match(Condition.Equals('true')),
})
```

---

## API surface

### `Query(key)`

Creates a reference to a URL query string parameter.

```typescript
import { Query } from '@ministryofjustice/hmpps-forge/core/authoring'
```

`key` is a string matching the query parameter name. Supports dot
notation for nested access.

Returns a chainable reference that supports `.path()`, `.match()`,
`.pipe()`, and `.each()`.

---

## Best practices

- **Guard on presence before acting.** Query parameters are
  optional. Use `Query('key').match(Condition.IsRequired())` in a
  `when` condition to check before running effects or redirects.
- **Use query parameters for optional state, route parameters for
  required state.** A case ID that every step needs belongs in the
  path as `:caseId`. A filter or tab selection that only matters for
  display belongs in the query string.
- **Redirect to a canonical URL when values are invalid.** If a
  query parameter has an unexpected value, redirect to a default
  rather than rendering with bad state.
