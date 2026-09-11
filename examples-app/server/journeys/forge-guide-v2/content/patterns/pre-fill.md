---
title: Pre-fill from an external system
slug: pre-fill
section: patterns
path: patterns/pre-fill
nav: Data and integrations
order: 11
description: Try an address lookup that pre-fills editable fields without leaving the page
---

# Pre-fill from an external system

Look up an address by postcode, then review or edit the suggested values before
confirming. The lookup and Continue buttons validate different groups of fields.

This example uses a simulated address lookup with local sample data in place of
an external API. Edit the files below and select **Run** to try your changes.
Drafts stay in the preview session; confirmed answers go into a separate in-memory
answer store.

:::playground
---
title: Pre-fill
base: /assets/playground/pre-fill/
entry: journey.ts
start: /pre-fill/overview
---
journey.ts
effects.ts
AnswerStore.ts
AddressLookup.ts
overview.ts
find-address.ts
check-answers.ts
confirmation.ts
:::
