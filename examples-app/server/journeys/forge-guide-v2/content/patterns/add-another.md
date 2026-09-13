---
title: Adding, editing and deleting from collections
slug: add-another
section: patterns
path: patterns/add-another
nav: Collections
order: 8
description: Add, change and remove emergency contacts, then confirm the collection.
---

# Adding, editing and deleting from collections

Let someone manage a collection through a list and a separate form for each item.
This example collects emergency contacts, with routes to add, change and remove
a contact before reviewing the collection.

## Try the pattern

1. Start with no contacts and continue to see the requirement to add at least one.
2. Add two contacts, then change one and check that the other is unchanged.
3. Open a removal page, cancel once, then confirm a removal and review the list.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

:::playground
---
title: Add another
base: /assets/playground/add-another/
entry: journey.ts
start: /add-another/overview
---
journey.ts
effects.ts
AnswerStore.ts
overview.ts
your-contacts.ts
add-contact.ts
edit-contact.ts
delete-contact.ts
check-answers.ts
confirmation.ts
:::

:::note
---
---
Both the preview session and saved records are in memory and disappear on a
restart or guide-page reload.
:::

## How it works

`your-contacts.ts` renders `Answer('contacts')` through a `CollectionBlock` and
`Iterator.Map`. Each contact becomes a summary card with change and remove links.
The collection block supplies an empty-state message when there are no contacts.

The item forms use temporary contact fields. In `effects.ts`, `addContact()` reads
those fields and appends a contact; the edit effects load and update the selected
contact. The remove flow loads the selected item for confirmation before deleting
it. These operations use the index in the route and clear temporary fields when
they are no longer needed.

Adding an item and continuing the journey are separate actions. The add button
can open an empty form, while continuing validates the collection. Final
confirmation saves it through `AnswerStore.ts` and clears the draft.

## Adapting the pattern

A route index is enough for this local list. Use a stable record identifier when
items can be reordered or changed by someone else. For several small items edited
on one page, compare
[Repeating fieldsets](/forge-guide-v2/patterns/repeating-fieldsets).
