---
title: Search and select
slug: search-and-select
section: patterns
path: patterns/search-and-select
nav: Searching and results
order: 16
description: Search a station directory and open the details of a matching result.
---

# Search and select

Let someone narrow a directory before opening an item. This example searches
station names, presents matching results and links each result to a details page.

## Try the pattern

1. Search for `King`, `Brixton` or `Piccadilly` and open a result.
2. Return to search and check that the previous query is still available.
3. Search for a name with no matches to see the empty-result message.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

:::playground
---
title: Search and select
base: /assets/playground/search-and-select/
entry: journey.ts
start: /search-and-select/overview
---
journey.ts
effects.ts
StationService.ts
search.ts
station.ts
overview.ts
:::

:::note
---
---
The station service uses a local directory rather than a remote search API.
Restarting the preview or reloading the guide page clears the saved search
query.
:::

## How it works

`search.ts` stores the query on submission and redirects back to itself.
On access, `searchStations()` reads that answer, asks the injected station service
for matches and puts the results into `Data('searchResults')`.

A `CollectionBlock` maps each result into its name, a short description and a
link. The fallback message is conditional on `Data('hasSearched')`, so the initial
page does not announce a failed search before someone has searched. An empty
query also avoids calling the service.

`station.ts` loads the selected station using its route parameter. The search
query is draft state in the preview session, while results are loaded for the
request.

## Adapting the pattern

Keep the query when someone returns from an item so they can continue comparing
results. For larger result sets, combine this approach with
[Pagination](/forge-guide-v2/patterns/pagination). A production directory should
use stable item identifiers rather than the local array indexes used here.
