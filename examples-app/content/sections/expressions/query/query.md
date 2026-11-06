---
title: Query
section: authoring-language
path: authoring-language/query
teaches: [query, query-string, query-parameters]
prerequisites: [step, StepDefinition, onAccess]
---

<p class="govuk-caption-xl">References</p>

# Query

`query()` references URL query string parameters. When a user
navigates to `/overview?type=current`, `query("type")` resolves to
`"current"`. It's how you respond to optional context passed through
the URL without it being part of the route structure.

{{slot:toc}}

---

## What is Query?

Query string parameters are the key-value pairs that appear after
the `?` in a URL. Unlike route parameters, they are not defined in
the step's path. They can be present or absent on any request, which
makes them well suited for optional concerns like filters, display
state, and default values.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

query("type")
```

A typical use is filtering what a page displays. A URL like
`/results?type=current` tells the page which subset to show, and
an access hook can redirect to a sensible default when the
parameter is missing or invalid:

```rust
access(obj! {
    "when": query("type").not().matches(condition::array::is_in(["current", "future", "achieved"])),
    "next": [redirect(obj! { "goto": "overview?type=current" })],
})
```

Because query parameters are optional by nature, you will often
guard on their presence with `condition::is_required()` or validate
their value before acting on them.

---

## How it works

When Forge evaluates `query("type")`, it reads the value from the
current request's query string. If the parameter is present, the
expression resolves to its string value. If it is absent, it
resolves to `undefined`.

Query string values are always strings (or arrays of strings when a
parameter repeats). A URL like `?page=2` gives `query("page")` the
value `"2"`, not the number `2`. Use `.pipe()` with a transformer if
you need a different type.

In effect functions, the same values are available through
`context.get_query_param(key)` and `context.get_all_query_params()`:

```rust
FunctionEntry::effect("LoadFilteredResults", move |context, _args| {
    let api = api.clone();
    async move {
        let type_param = context.get_query_param("type");
        let kind = type_param.as_str().unwrap_or("current").to_owned();
        let results = api.get_goals(&kind).await?;
        context.set_data("goals", results)
    }
})
```

---

## Using in your definitions

### Filtering and display state

Query parameters work well for controlling what a page shows
without changing the underlying route. A tabs-style interface, a
sort order, or a search filter can all be driven by query
parameters:

```rust
access(obj! {
    "when": query("type").not().matches(condition::array::is_in(["current", "future", "achieved"])),
    "next": [redirect(obj! { "goto": "overview?type=current" })],
})
```

### Preserving query values in links

Use `format()` to carry query parameters through to other URLs,
so context is not lost when the user navigates:

```rust
govuk::BACK_LINK.build(obj! {
    "href": when(query("type").matches(condition::is_required())).then(format("overview?type=%1", [query("type").into()])).otherwise("overview"),
})
```

### Pre-filling fields

A query parameter can set a field's initial value. A search page
linked to with `?q=something` can pre-populate the search box:

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "searchTerm",
    "label": obj! { "text": "Search" },
    "defaultValue": query("q"),
})
```

### Conditional visibility

Show or hide blocks based on a query parameter:

```rust
govuk::INSET_TEXT.build(obj! {
    "text": "Need help? Contact the support team.",
    "visibleWhen": query("showHelp").matches(condition::equals("true")),
})
```

---

## API surface

### `query(key)`

Creates a reference to a URL query string parameter.

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};
```

`key` is a string matching the query parameter name. Supports dot
notation for nested access.

Returns a chainable reference that supports `.path()`, `.matches()`,
`.pipe()`, and `.each()`.

---

## Best practices

- **Guard on presence before acting.** Query parameters are
  optional. Use `query("key").matches(condition::is_required())` in a
  `when` condition to check before running effects or redirects.
- **Use query parameters for optional state, route parameters for
  required state.** A case ID that every step needs belongs in the
  path as `:caseId`. A filter or tab selection that only matters for
  display belongs in the query string.
- **Redirect to a canonical URL when values are invalid.** If a
  query parameter has an unexpected value, redirect to a default
  rather than rendering with bad state.
