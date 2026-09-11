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

Browse a directory of stations, five at a time. Open a station's details and return
to the same page of results. The query parameter selects the page, and access
effects prepare the current results and pagination links.

Edit the files below and select **Run** to try your changes.

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
