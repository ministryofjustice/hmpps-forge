---
title: Pagination
section: patterns
path: patterns/pagination
teaches: [pagination, query-parameters, Data, CollectionBlock, effects]
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
  `Data()` expressions.

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

```typescript
LoadStationPage: () => (context) => {
  const pageParam = context.getQueryParam('page')
  const pageSize = 5
  const totalPages = Math.ceil(allStations.length / pageSize)
  const page = Math.min(Math.max(1, parseInt(pageParam ?? '1', 10)), totalPages)
  const start = (page - 1) * pageSize

  context.setData('stations', allStations.slice(start, start + pageSize))
  context.setData('currentPage', page)
  context.setData('pages', Array(totalPages).fill(0))
}
```

### Conditional navigation links

Previous and Next links derive their `href` values from the current
page. `visibleWhen` omits the link when there is no page to navigate
to:

```typescript
GovUKPagination({
  previous: {
    href: Format('?page=%1', Data('currentPage').pipe(Transformer.Number.Add(-1))),
    visibleWhen: Data('currentPage').match(Condition.Number.GreaterThan(1)),
  },
  next: {
    href: Format('?page=%1', Data('currentPage').pipe(Transformer.Number.Add(1))),
    visibleWhen: Data('currentPage').match(
      Condition.Number.LessThan(Data('pages').pipe(Transformer.Array.Length())),
    ),
  },
})
```

The page label can be generated the same way:

```typescript
GovUKBody({
  text: Format('Page %1 of %2', Data('currentPage'), Data('pages').pipe(Transformer.Array.Length())),
})
```

---

## Variations

- **Numbered pages.** Use `GovUKPagination` with static `items` for
  a fixed number of pages, or build dynamic page number links with
  `CollectionBlock` and `Iterator.Map`.
- **Combined with search.** Add pagination to search results by
  reading both `?q` and `?page` query parameters in the same effect.
- **Page size selector.** Let users choose how many items per page
  with a select input, reading the preference from a query parameter
  or session value.
