---
title: 'Pattern in the browser: Branching'
section: packages
path: packages/forge-browser/pattern-branching
teaches: [forge-browser]
prerequisites: [forge-browser]
---

<p class="govuk-caption-xl">Browser Adapter</p>

# Pattern in the browser: Branching

The [branching pattern](/forge-developer-guide/patterns/branching) running entirely client-side - the same
`next[]` redirect rules, validation, and check-answers `visibleWhen` rows, compiled at runtime and
executed in the page. Pick a meeting type and only that branch's follow-up step appears; the check-answers
page shows only the branch you took, and Change links re-enter the journey without a server anywhere.

The application registers this package at startup. Navigate to it from the application's side
navigation without leaving the page or asking the server for another page.

[Open the branching package](/browser-demo/branching/visit-type){.govuk-button}
