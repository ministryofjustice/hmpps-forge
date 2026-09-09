---
title: 'Pattern in the browser: Add another'
section: packages
path: packages/forge-browser/pattern-add-another
teaches: [forge-browser]
prerequisites: [forge-browser]
---

<p class="govuk-caption-xl">Browser Adapter</p>

# Pattern in the browser: Add another

The [add-another pattern](/forge-developer-guide/patterns/add-another) running entirely client-side - a
collection of contacts rendered through an iterator into summary cards, with add, edit, and delete flows
appending to, replacing in, and splicing from the `contacts` answer. The whole collection lives in the
session draft, so a reload keeps your contacts - and the network tab stays empty throughout.

The application registers this package at startup. Navigate to it from the application's side
navigation without leaving the page or asking the server for another page.

[Open the add-another package](/browser-demo/add-another/your-contacts){.govuk-button}
