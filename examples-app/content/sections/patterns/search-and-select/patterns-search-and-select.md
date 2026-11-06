---
title: Search and select
section: patterns
path: patterns/search-and-select
teaches: [search-and-select, core_blocks::COLLECTION_BLOCK, data, iterator, effects]
prerequisites: [effects, data, blocks]
---

<p class="govuk-caption-xl">Patterns</p>

# Search and select
A search page where the user enters a query, results are fetched and
displayed, and the user selects a result to view its details.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/search-and-select" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Use this pattern when users need to find a specific item from a large
or dynamic data set before they can continue. Common examples include:

- Looking up an address by postcode.
- Searching for a person by name or identifier.
- Selecting a record from an external system.

It fits well when the result set is too large for a simple select
dropdown and the user needs to refine by searching.

---

## What the pattern covers

The live demo searches a directory of London Underground stations by
name. Following the flow shows:

- **A text input and submit button** that triggers a search effect via
  POST-redirect-GET.
- **Dynamic results** rendered with `core_blocks::COLLECTION_BLOCK` and
  `data("searchResults")`, using `iterator::map` to display each match.
- **A detail page** loaded by route parameter (`:index`), displaying
  the full record via `data()` references.
- **Draft answer persistence** so the search query survives the
  redirect and pre-fills the input.

---

## Anatomy of the flow

```
/forge-developer-guide/patterns/demos/search-and-select/
├── /overview        → Pattern description and "Start" button
├── /search          → Text input, submit, and results list
└── /station/:index  → Station detail page
```

The search page uses the POST-redirect-GET pattern: submitting the
form saves the query as a draft answer, then redirects back to the
same page. On the GET request, the `onAccess` effect reads the saved
query and sets the matching results as `Data`.

---

## How it works

### The search effect

An effect reads the search query from the saved answers, filters a
data source, and sets the results as `Data` for the page to render:

```rust
FunctionEntry::effect("SearchStations", |context, _args| async move {
    let query = context.get_answer("searchQuery").as_str().map(|q| q.trim().to_lowercase()).unwrap_or_default();

    if query.is_empty() {
        return context.set_data("searchResults", Value::from(Vec::<Value>::new()));
    }

    let results: Vec<Value> = stations()
        .iter()
        .enumerate()
        .filter(|(_, s)| s.name.to_lowercase().contains(&query))
        .map(|(i, s)| obj! { "name": s.name, "lines": s.lines, "zone": s.zone, "href": format!("station/{i}") })
        .collect();

    context.set_data("searchResults", Value::from(results))?;
    context.set_data("hasSearched", Value::from("true"))
})
```

### Rendering results with CollectionBlock

`core_blocks::COLLECTION_BLOCK` iterates over the `data("searchResults")` array.
Each item is rendered using `iterator::map` with `item().path()` to
access properties:

```rust
core_blocks::COLLECTION_BLOCK.build(obj! {
    "collection": data("searchResults").each(iterator::map(core_blocks::HTML.build(obj! {
        "tag": "div",
        "content": [
            govuk::HEADING.build(obj! { "text": item().path("name"), "size": "s" }),
            govuk::BODY.build(obj! {
                "text": format("Lines: %1 - Zone %2", [item().path("lines").into(), item().path("zone").into()]),
            }),
            core_blocks::HTML.build(obj! {
                "tag": "a",
                "classes": "govuk-link",
                "attributes": obj! { "href": item().path("href") },
                "content": "View station details",
            }),
        ],
    }))),
    "fallback": [
        govuk::INSET_TEXT.build(obj! {
            "text": "No matching stations found.",
            "visibleWhen": data("hasSearched").matches(condition::is_required()),
        }),
    ],
})
```

The `fallback` array renders when the collection is empty, and the
`visibleWhen` on the fallback block ensures it only appears after a
search has been performed (not on the initial page load).

### Loading a detail record

The detail page uses a route parameter (`:index`) to identify which
record to load. An `onAccess` effect reads the parameter and sets
`Data` values for the page blocks:

```rust
FunctionEntry::effect("LoadStation", |context, _args| async move {
    let index = context.get_request_param("index").as_str().and_then(|i| i.parse::<usize>().ok());

    if let Some(station) = index.and_then(|i| stations().get(i)) {
        context.set_data("stationName", station.name.into())?;
        context.set_data("stationLines", station.lines.into())?;
        context.set_data("stationZone", station.zone.into())?;
        context.set_data("stationOpened", station.opened.into())?;
    }
    Ok(())
})
```

---

## Variations

- **GET-based search.** Instead of POST-redirect-GET, use a raw HTML
  form with `method="get"` and read the query from
  `context.get_query_param("q")`. This avoids storing the query in the
  session but means the URL contains the search term.
- **Paginated results.** For larger data sets, pass a page number as
  a query parameter and slice the results in the effect.
- **Select and continue.** Instead of navigating to a detail page,
  store the selected item's ID as an answer and redirect to the next
  step in the journey.
- **Filter by category.** Add a select or radio input alongside the
  search text field to narrow results by a category (e.g. tube line
  or zone). The effect reads both values and applies both filters.
