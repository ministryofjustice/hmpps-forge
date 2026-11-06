---
title: Pagination
section: patterns
path: patterns/pagination
teaches: [pagination, query-parameters, data, core_blocks::COLLECTION_BLOCK, effects]
prerequisites: [effects, data, blocks]
---

<p class="govuk-caption-xl">Patterns</p>

# Pagination
A paginated list that splits a large data set across multiple pages.
The user navigates between pages using Previous and Next links.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/pagination" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Use pagination when displaying all items on a single page would be
overwhelming or slow. Common examples include:

- Search results (combined with the search-and-select pattern).
- Case lists or record directories.
- Transaction histories or audit logs.

Five to twenty items per page is typical for GOV.UK services. Prefer
fewer items with more detail over many items with less.

---

## What the pattern covers

The live demo paginates a directory of 20 London Underground stations,
five per page. Following the flow shows:

- **Reading a query parameter** (`?page=N`) in an `onAccess` effect
  to determine which page to show.
- **Slicing the data set** and setting the page items plus compact
  pagination state as `Data`.
- **CollectionBlock** rendering the current page of results.
- **Conditional Previous and Next links** deriving their URLs from
  `data()` expressions.
- **Numbered page links** built dynamically with `iterator::map` and
  `Loop.index()`.

---

## Anatomy of the flow

```
/forge-developer-guide/patterns/demos/pagination/
├── /overview        → Pattern description and "Start" button
├── /list            → Paginated station list (?page=1, ?page=2, ...)
└── /detail/:index   → Station detail page
```

The list page reads `?page` from the URL on each GET request. No
session state is needed - the current page is encoded entirely in
the URL.

---

## How it works

### The pagination effect

An `onAccess` effect reads the `?page` query parameter, slices the
data set, and sets the current page plus a page-count array as `Data`:

```rust
FunctionEntry::effect("LoadStationPage", |context, _args| async move {
    const PAGE_SIZE: usize = 5;
    let all_stations = stations();
    let total_pages = all_stations.len().div_ceil(PAGE_SIZE);
    let page = context
        .get_query_param("page")
        .as_str()
        .and_then(|p| p.parse::<usize>().ok())
        .unwrap_or(1)
        .clamp(1, total_pages);
    let start = (page - 1) * PAGE_SIZE;

    context.set_data("stations", Value::from(all_stations[start..].iter().take(PAGE_SIZE).map(Station::to_value).collect::<Vec<_>>()))?;
    context.set_data("currentPage", Value::from(page))?;
    context.set_data("pages", Value::from(vec![0; total_pages]))
})
```

### Conditional navigation links

Previous and Next links derive their `href` values from the current
page. `visibleWhen` omits the link when there is no page to navigate
to:

```rust
govuk::PAGINATION.build(obj! {
    "previous": obj! {
        "href": format("?page=%1", [data("currentPage").pipe([transformer::number::add(-1)]).into()]),
        "visibleWhen": data("currentPage").matches(condition::number::greater_than(1)),
    },
    "next": obj! {
        "href": format("?page=%1", [data("currentPage").pipe([transformer::number::add(1)]).into()]),
        "visibleWhen": data("currentPage").matches(condition::number::less_than(data("pages").pipe([transformer::array::length()]))),
    },
    "items": data("pages").each(iterator::map(obj! {
        "number": Loop.index(),
        "href": format("?page=%1", [Loop.index().into()]),
        "current": Loop.index().matches(condition::equals(data("currentPage"))),
    })),
})
```

The `items` array maps over the page-count array set by the effect,
using `Loop.index()` (1-based) as both the page number and the link
target.

The page label can be generated the same way:

```rust
govuk::BODY.build(obj! {
    "text": format("Page %1 of %2", [data("currentPage").into(), data("pages").pipe([transformer::array::length()]).into()]),
})
```

---

## Variations

- **Previous and Next only.** Omit the `items` array to show just the
  Previous and Next links, which suits very long result sets where
  jumping to an arbitrary page is less useful.
- **Combined with search.** Add pagination to search results by
  reading both `?q` and `?page` query parameters in the same effect.
- **Page size selector.** Let users choose how many items per page
  with a select input, reading the preference from a query parameter
  or session value.
