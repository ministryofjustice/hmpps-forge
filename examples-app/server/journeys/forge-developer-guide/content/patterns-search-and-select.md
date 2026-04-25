---
title: Search and select
section: patterns
path: patterns/search-and-select
teaches: [search-and-select, CollectionBlock, Data, Iterator, effects]
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
- **Dynamic results** rendered with `CollectionBlock` and
  `Data('searchResults')`, using `Iterator.Map` to display each match.
- **A detail page** loaded by route parameter (`:index`), displaying
  the full record via `Data()` references.
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

```typescript
SearchStations: () => (context) => {
  const query = (context.getAnswer('searchQuery') as string)
    ?.trim().toLowerCase()

  if (!query) {
    context.setData('searchResults', [])
    return
  }

  const results = allStations
    .filter(s => s.name.toLowerCase().includes(query))
    .map(s => ({ ...s, href: `station/${s.index}` }))

  context.setData('searchResults', results)
  context.setData('hasSearched', 'true')
}
```

### Rendering results with CollectionBlock

`CollectionBlock` iterates over the `Data('searchResults')` array.
Each item is rendered using `Iterator.Map` with `Item().path()` to
access properties:

```typescript
CollectionBlock({
  collection: Data('searchResults').each(
    Iterator.Map(
      HtmlBlock({
        tag: 'div',
        content: [
          GovUKHeading({ text: Item().path('name'), size: 's' }),
          GovUKBody({
            text: Format('Lines: %1 — Zone %2',
              Item().path('lines'), Item().path('zone')),
          }),
          HtmlBlock({
            tag: 'a',
            classes: 'govuk-link',
            attributes: { href: Item().path('href') },
            content: 'View station details',
          }),
        ],
      }),
    ),
  ),
  fallback: [
    GovUKInsetText({ text: 'No matching stations found.',
      visibleWhen: Data('hasSearched').match(Condition.IsRequired()) }),
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

```typescript
LoadStation: () => (context) => {
  const index = parseInt(context.getRequestParam('index'), 10)

  if (index >= 0 && index < allStations.length) {
    const station = allStations[index]
    context.setData('stationName', station.name)
    context.setData('stationLines', station.lines)
    context.setData('stationZone', station.zone)
    context.setData('stationOpened', station.opened)
  }
}
```

---

## Variations

- **GET-based search.** Instead of POST-redirect-GET, use a raw HTML
  form with `method="get"` and read the query from
  `context.getQueryParam('q')`. This avoids storing the query in the
  session but means the URL contains the search term.
- **Paginated results.** For larger data sets, pass a page number as
  a query parameter and slice the results in the effect.
- **Select and continue.** Instead of navigating to a detail page,
  store the selected item's ID as an answer and redirect to the next
  step in the journey.
- **Filter by category.** Add a select or radio input alongside the
  search text field to narrow results by a category (e.g. tube line
  or zone). The effect reads both values and applies both filters.
