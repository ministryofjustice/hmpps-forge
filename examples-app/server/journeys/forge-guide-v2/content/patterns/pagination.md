---
title: Pagination
slug: pagination
section: patterns
path: patterns/pagination
nav: Searching and results
order: 17
description: Browse pages of stations and return from a detail page to the right list page.
---

# Pagination

Split a list into pages while keeping each page addressable by its URL. This
example shows five stations at a time and returns from station details to the
page containing that station.

## Try the pattern

1. Start the pattern and move through the numbered pages and **Next** link.
2. Open a station from a later page, then return to the list.
3. Visit the first and last pages to compare the previous and next controls.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

:::playground
---
title: Pagination
base: /assets/playground/pagination/
entry: journey.ts
start: /pagination/overview
---
journey.ts
effects.ts
overview.ts
list.ts
detail.ts
:::

## How it works

`loadStationPage()` in `effects.ts` reads the `page` query parameter, defaults it
to the first page and clamps it to the available range. It slices the local list
and supplies the current page, page links and visible stations through `Data()`.

The list step renders the stations and a `GovUKPagination` component. Numbered
links carry the page query parameter; previous and next links are shown only when
there is a page in that direction. The current position belongs to the URL rather
than a session variable.

When a details page loads, its effect also calculates which list page contains
that station. The return link uses that page number, avoiding a return to the
start of the list after every visit. This calculation works because the demo's
local directory has a fixed order.

## Adapting the pattern

For a larger data source, ask the service for a page of results instead of loading
and slicing the whole collection in the browser. If the list can be filtered or
sorted, carry that context into details and return links as well as the page
number.
