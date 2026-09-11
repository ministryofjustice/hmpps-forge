---
title: Multi-part composite fields
slug: composite-fields
section: patterns
path: patterns/composite-fields
nav: Input and forms
order: 4
description: Collect a date and address through multiple inputs, then display them together
---

# Multi-part composite fields

Collect a date of birth as day, month and year, then ask for an address. The summary
formats the date and combines the address lines, with change links to edit either.

Edit the files below and select **Run** to try your changes. Drafts stay in the
preview session; confirmed answers go into a separate in-memory answer store.

:::playground
---
title: Composite fields
base: /assets/playground/composite-fields/
entry: journey.ts
start: /composite-fields/overview
---
journey.ts
effects.ts
AnswerStore.ts
overview.ts
date-of-birth.ts
address.ts
check-answers.ts
confirmation.ts
:::
